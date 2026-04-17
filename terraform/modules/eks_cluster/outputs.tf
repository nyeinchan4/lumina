output "cluster_id" {
  value = aws_eks_cluster.eks_cluster.id
}

output "cluster_security_group_id" {
  value = aws_eks_cluster.eks_cluster.vpc_config[0].cluster_security_group_id
}

output "cluster_name" {
  value = aws_eks_cluster.eks_cluster.name
}
