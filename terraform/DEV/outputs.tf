output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint — use this as DB_HOST in secret.yaml"
  value       = module.rds.rds_endpoint
}

output "eks_node_role_arn" {
  description = "Node IAM role ARN — use this in terraform/aws-auth-cm.yaml"
  value       = module.eks_cluster_nodes.eks_node_role_arn
}
