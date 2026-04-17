# Amazon EKS Cluster Setup Guide

This guide walks you through provisioning an Amazon EKS cluster using Terraform, authenticating with it, and ensuring your worker nodes correctly join the cluster.

## Terraform Code Flow Overview
The Terraform configuration in this repository is separated into modular parts:
* **`main.tf`**: Configures the AWS Provider and declares high-level resource outputs.
* **`variables.tf`**: Defines input variables and their default values (e.g. `cluster_name`, node capacities).
* **`data.tf`**: Dynamically fetches required AWS infrastructure variables like VPC networks, subnets, and node AMIs.
* **`policies.tf` / `policy.yaml`**: Defines and binds the required AWS IAM policies.
* **`eks.tf`**: Provisions the main EKS Control Plane cluster and its designated IAM Service Roles.
* **`nodes.tf`**: Provisions the unmanaged Worker Nodes. It establishes the required EC2 Launch Template, Security Groups, Node IAM Roles, and the Auto Scaling Group.

## 1. Provision the Cluster with Terraform
First, initialize and apply the Terraform configuration to build your EKS cluster and the unmanaged worker nodes.

```bash
terraform init
terraform apply -auto-approve
```

## 2. Authenticate with the EKS Cluster
Once the cluster has been successfully provisioned, you need to configure your local `kubeconfig` to authenticate with it via the AWS CLI. 

Run the following command, specifying your AWS region and the generated cluster name (default `dev-cluster`):

```bash
aws eks update-kubeconfig --region us-east-1 --name dev-cluster
```

## 3. (Optional) Setup `kubectl` Alias in PowerShell
If you are on Windows using PowerShell, you can set up `k` as a permanent alias for `kubectl` by adding it to your profile:

```powershell
if (!(Test-Path -Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }
Add-Content -Path $PROFILE -Value "Set-Alias -Name k -Value kubectl"
```
*After running the above, restart your terminal or run `. $PROFILE` to apply it.*

## 4. Allow Worker Nodes to Join the Cluster
Because this infrastructure uses an unmanaged EC2 Auto Scaling Group for worker nodes, the nodes will not automatically register with the EKS control plane. You must create an `aws-auth` ConfigMap to map their IAM role to the Kubernetes `system:nodes` group.

An `aws-auth-cm.yaml` file has been provided/created with the following contents:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: <YOUR_NODE_ROLE_ARN>  # e.g., arn:aws:iam::891376934402:role/eksWorkerNodeRole
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
```

Apply this ConfigMap to the cluster:
```bash
kubectl apply -f aws-auth-cm.yaml
```

## 5. Verify the Nodes
After a minute, verify that all worker nodes have joined and transition into the `Ready` status:

```bash
kubectl get nodes
```

Your Amazon EKS cluster is now fully configured and ready for workloads!
