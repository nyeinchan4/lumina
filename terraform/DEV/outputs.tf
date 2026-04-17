output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint — use this as DB_HOST in secret.yaml"
  value       = module.rds.rds_endpoint
}
