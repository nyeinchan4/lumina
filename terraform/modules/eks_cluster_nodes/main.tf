####################################################################
#
# Creates an unmanaged node group (Self-Managed Nodes)
#
####################################################################

# Fetch the optimized AMI for EKS
data "aws_ssm_parameter" "node_ami" {
  name = "/aws/service/eks/optimized-ami/${var.kubernetes_version}/amazon-linux-2/recommended/image_id"
}

# IAM policy for Load Balancer Controller (Basic version)
resource "aws_iam_policy" "loadbalancer_policy" {
  name        = "${var.cluster_name}-loadbalancer-policy"
  path        = "/"
  description = "Policy for AWS Load Balancer Controller"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeAccountAttributes",
          "ec2:DescribeAddresses",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeTags",
          "elasticloadbalancing:*",
          "iam:CreateServiceLinkedRole",
          "iam:GetServerCertificate",
          "iam:ListServerCertificates"
        ]
        Resource = "*"
      }
    ]
  })
}

# Create an SSH key pair for logging into the EC2 instances
resource "tls_private_key" "key_pair" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_sensitive_file" "pem_file" {
  filename        = pathexpand("~/.ssh/${var.cluster_name}-eks-nodes.pem")
  file_permission = "600"
  content         = tls_private_key.key_pair.private_key_pem
}

resource "aws_key_pair" "eks_kp" {
  key_name   = "${var.cluster_name}-keypair"
  public_key = trimspace(tls_private_key.key_pair.public_key_openssh)
}

data "aws_iam_policy_document" "assume_role_ec2" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# IAM role to assign to worker nodes
resource "aws_iam_role" "node_instance_role" {
  name               = var.node_role_name
  assume_role_policy = data.aws_iam_policy_document.assume_role_ec2.json
  path               = "/"
}

resource "aws_iam_role_policy_attachment" "node_instance_role_EKSWNP" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node_instance_role.name
}

resource "aws_iam_role_policy_attachment" "node_instance_role_EKSCNIP" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node_instance_role.name
}

resource "aws_iam_role_policy_attachment" "node_instance_role_EKSCRRO" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node_instance_role.name
}

resource "aws_iam_role_policy_attachment" "node_instance_role_SSMMIC" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.node_instance_role.name
}

resource "aws_iam_role_policy_attachment" "node_instance_role_loadbalancer" {
  policy_arn = aws_iam_policy.loadbalancer_policy.arn
  role       = aws_iam_role.node_instance_role.name
}

# Instance profile to associate above role with worker nodes
resource "aws_iam_instance_profile" "node_instance_profile" {
  name = "${var.cluster_name}-NodeInstanceProfile"
  path = "/"
  role = aws_iam_role.node_instance_role.id
}

# Security group to apply to worker nodes
resource "aws_security_group" "node_security_group" {
  name        = "${var.cluster_name}-node-sg"
  description = "Security group for all nodes in the cluster"
  vpc_id      = var.vpc_id
  tags = {
    "Name"                                      = "${var.cluster_name}-node-sg"
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  }
}

resource "aws_vpc_security_group_ingress_rule" "node_security_group_ingress" {
  description                  = "Allow nodes to communicate with each other"
  ip_protocol                  = "-1"
  security_group_id            = aws_security_group.node_security_group.id
  referenced_security_group_id = aws_security_group.node_security_group.id
}

resource "aws_vpc_security_group_egress_rule" "node_egress_all" {
  description       = "Allow node egress to anywhere"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.node_security_group.id
}

resource "aws_vpc_security_group_ingress_rule" "node_security_group_from_control_plane_ingress" {
  description                  = "Allow nodes to receive communication from the cluster control plane"
  security_group_id            = aws_security_group.node_security_group.id
  referenced_security_group_id = var.cluster_security_group_id
  from_port                    = 1025
  to_port                      = 65535
  ip_protocol                  = "TCP"
}

resource "aws_vpc_security_group_ingress_rule" "node_security_group_from_control_plane_443" {
  description                  = "Allow nodes to receive 443 communication from cluster control plane"
  security_group_id            = aws_security_group.node_security_group.id
  referenced_security_group_id = var.cluster_security_group_id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "TCP"
}

# Cluster SG rules to allow nodes to talk back
resource "aws_vpc_security_group_ingress_rule" "cluster_control_plane_security_group_ingress" {
  description                  = "Allow pods to communicate with the cluster API Server"
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "TCP"
  referenced_security_group_id = aws_security_group.node_security_group.id
  security_group_id            = var.cluster_security_group_id
}

# Launch Template
resource "aws_launch_template" "node_launch_template" {
  name = "${var.cluster_name}-node-launch-template"

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      delete_on_termination = true
      volume_size           = 30
      volume_type           = "gp2"
    }
  }

  iam_instance_profile {
    name = aws_iam_instance_profile.node_instance_profile.name
  }

  key_name      = aws_key_pair.eks_kp.key_name
  instance_type = var.node_instance_type
  vpc_security_group_ids = [
    aws_security_group.node_security_group.id
  ]

  image_id = data.aws_ssm_parameter.node_ami.value

  metadata_options {
    http_put_response_hop_limit = 2
    http_endpoint               = "enabled"
    http_tokens                 = "optional"
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.cluster_name}-worker-node"
    }
  }

  user_data = base64encode(<<EOF
#!/bin/bash
set -o xtrace
/etc/eks/bootstrap.sh ${var.cluster_name}
EOF
  )
}

# CloudFormation stack for Auto Scaling Group
resource "aws_cloudformation_stack" "autoscaling_group" {
  name          = "${var.cluster_name}-asg-stack"
  template_body = <<EOF
Description: "Node autoscaler for ${var.cluster_name}"
Resources:
  NodeGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      VPCZoneIdentifier: ["${join("\",\"", var.private_subnet_ids)}"]
      MinSize: "${var.node_group_min_size}"
      MaxSize: "${var.node_group_max_size}"
      DesiredCapacity: "${var.node_group_desired_capacity}"
      HealthCheckType: EC2
      LaunchTemplate:
        LaunchTemplateId: "${aws_launch_template.node_launch_template.id}"
        Version: "${aws_launch_template.node_launch_template.latest_version}"
      Tags:
        - Key: Name
          Value: ${var.cluster_name}-worker-node
          PropagateAtLaunch: true
        - Key: kubernetes.io/cluster/${var.cluster_name}
          Value: owned
          PropagateAtLaunch: true
    UpdatePolicy:
      AutoScalingRollingUpdate:
        MaxBatchSize: 1
        MinInstancesInService: "${var.node_group_min_size}"
        PauseTime: PT5M
Outputs:
  NodeAutoScalingGroup:
    Description: The autoscaling group
    Value: !Ref NodeGroup
EOF
}