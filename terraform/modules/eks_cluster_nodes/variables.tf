variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
}

variable "vpc_id" {
  type        = string
  description = "The VPC ID where the nodes will be created"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "A list of private subnet IDs for the node group"
}

variable "cluster_security_group_id" {
  type        = string
  description = "Security group ID of the EKS cluster"
}

variable "node_role_name" {
  type        = string
  description = "Name of the IAM role for the nodes"
  default     = "eks-node-role"
}

variable "node_instance_type" {
  type        = string
  description = "EC2 instance type for the worker nodes"
  default     = "t3.medium"
}

variable "node_group_desired_capacity" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 2
}

variable "node_group_max_size" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 3
}

variable "node_group_min_size" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 1
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the EKS nodes"
  default     = "1.29"
}
