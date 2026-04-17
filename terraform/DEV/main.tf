provider "aws" {
  region = var.aws_region
}

module "networking" {
  source           = "../modules/networking"
  env_prefix       = var.env_prefix
  region           = var.aws_region
  vpc_cidr         = var.vpc_cidr
  public_subnet_a  = var.public_subnet_a
  public_subnet_b  = var.public_subnet_b
  private_subnet_a = var.private_subnet_a
  private_subnet_b = var.private_subnet_b
  cluster_name     = var.cluster_name
}

module "eks_cluster" {
  source             = "../modules/eks_cluster"
  cluster_name       = "dev-cluster"
  private_subnet_ids = module.networking.private_subnet_ids
}

module "rds" {
  source             = "../modules/rds"
  vpc_id             = module.networking.vpc_id
  vpc_cidr           = var.vpc_cidr
  private_subnet_ids = module.networking.private_subnet_ids
  db_name            = var.db_name
  master_username    = var.master_username
  master_password    = var.master_password
}

module "eks_cluster_nodes" {
  source                    = "../modules/eks_cluster_nodes"
  cluster_name              = module.eks_cluster.cluster_name
  vpc_id                    = module.networking.vpc_id
  private_subnet_ids        = module.networking.private_subnet_ids
  cluster_security_group_id = module.eks_cluster.cluster_security_group_id
  
  # Optional: customize instance type or scaling
  node_instance_type          = "t3.medium"
  node_group_desired_capacity = 2
  node_group_min_size         = 1
  node_group_max_size         = 3
}
