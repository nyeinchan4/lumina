# EKS & RDS Terraform Setup Details

This document explains the code-level details of the Terraform configuration used to deploy a custom network, an EKS cluster, and an RDS PostgreSQL database.

---

## 1. `main.tf` (The Entry Point)
This file orchestrates the entire infrastructure by calling the underlying modules and passing configurations between them.

```hcl
module "networking" {
  source       = "./modules/networking"
  region       = var.aws_region
  cluster_name = var.cluster_name
  vpc_cidr     = "20.0.0.0/16"
}

module "rds" {
  source             = "./modules/RDS"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  vpc_cidr           = "20.0.0.0/16"
  
  db_identifier      = var.rds_db_identifier
  master_username    = var.rds_master_username
  master_password    = var.rds_master_password
  engine_version     = var.rds_engine_version
  instance_class     = "db.t3.micro"
}
```
*   **Modular Design**: Instead of one giant file, we separate concerns into Networking, RDS, and EKS logic.
*   **Dependency Injection**: The RDS module receives its `vpc_id` and `private_subnet_ids` directly from the Networking module outputs.

---

## 2. Networking Module (`modules/networking`)
Instead of using the default VPC, we build a dedicated network for isolation and security.

### VPC and Subnets
*   **VPC**: A new VPC with CIDR `20.0.0.0/16`.
*   **Public Subnets**: Used for the EKS Control Plane load balancers.
*   **Private Subnets**: Used for the EKS Worker Nodes and RDS Database to ensure they (mostly) aren't directly exposed to the internet.

### Route Tables
*   **Public RT**: Routes traffic to the **Internet Gateway (IGW)**.
*   **Private RT**: Routes internal traffic.

---

## 3. `eks.tf` (The Control Plane)
Provisions the managed Kubernetes "Master" nodes using our custom network.

```hcl
resource "aws_eks_cluster" "eks_cluster" {
  name     = var.cluster_name
  role_arn = var.use_predefined_role ? module.use_eksClusterRole[0].eksClusterRole_arn : module.create_eksClusterRole[0].eksClusterRole_arn

  vpc_config {
    subnet_ids = module.networking.private_subnet_ids
  }
}
```
*   **Subnet Placement**: The EKS cluster control plane is restricted to the **private subnets** for enhanced security.
*   **Access Mode**: Configured with `CONFIG_MAP` or `API` authentication modes for secure CLI access.

---

## 4. RDS Module (`modules/RDS`)
Deploys a PostgreSQL database for application data.

### Security Group (`dev-db-cluster-sg`)
*   **Ingress**: Only allows traffic on port **5432** from within the VPC CIDR (`20.0.0.0/16`). No external access is possible.

### Configuration
*   **Engine**: PostgreSQL 17.6-R2.
*   **Free Tier**: Uses `db.t3.micro` with 20GB of storage.
*   **IAM Auth**: Enabled, allowing Kubernetes pods to authenticate using IAM roles instead of just passwords.

---

## 5. `nodes.tf` (The Worker Nodes)
Worker nodes running on EC2, configured to join the cluster automatically.

### Scaling & Placement
```hcl
resource "aws_cloudformation_stack" "autoscaling_group" {
  template_body = <<EOF
    NodeGroup:
      Type: AWS::AutoScaling::AutoScalingGroup
      Properties:
        VPCZoneIdentifier: ["${join("\",\"", module.networking.private_subnet_ids)}"]
  EOF
}
```
*   **Private Placement**: Nodes are launched in private subnets.
*   **Bootstrap Script**: Each node runs a script to "phone home" to the EKS cluster and register itself.

---

## 6. `aws-auth-cm.yaml` (The Handshake)
Tells the Kubernetes API to trust the EC2 instances we just created.

```yaml
mapRoles: |
  - rolearn: arn:aws:iam::...:role/eksWorkerNodeRole
    username: system:node:{{EC2PrivateDNSName}}
    groups:
      - system:bootstrappers
      - system:nodes
```

---

## Summary of the Build Workflow
1.  **Network**: Create a custom isolated VPC with Public/Private subnets.
2.  **Database**: Provision RDS in the private subnets with strict firewall rules.
3.  **Control Plane**: Spin up the EKS "Brain" in the private network.
4.  **Worker Nodes**: Launch EC2 instances that automatically join the cluster.
5.  **Finalization**: Authorize the nodes via the `aws-auth` config map.
