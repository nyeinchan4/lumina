variable "cluster_name" {
  type        = string
  description = "Name of the cluster"
}

variable "predefined_role_arn" {
  type        = string
  description = "ARN of the predefined cluster role to use if use_predefined_role is true."
  default     = null
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "A list of private subnet IDs to place the EKS cluster and workers into."
}

variable "cluster_role_name" {
  type        = string
  description = "Name of the cluster role"
  default     = "eksClusterRole"
}

variable "additional_policy_arns" {
  type        = list(string)
  description = "ARNs of policies to attach to role"
  default     = []
}
