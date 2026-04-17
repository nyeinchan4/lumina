output "eks_node_role_arn" {
  value = aws_iam_role.node_instance_role.arn
}