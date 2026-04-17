variable "env_prefix" {
  description = "The prefix used for all resource names"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "20.0.0.0/16"
}

variable "public_subnet_a" {
  type    = string
  default = "20.0.1.0/24"
}

variable "public_subnet_b" {
  type    = string
  default = "20.0.2.0/24"
}

variable "private_subnet_a" {
  type    = string
  default = "20.0.3.0/24"
}

variable "private_subnet_b" {
  type    = string
  default = "20.0.4.0/24"
}

variable "cluster_name" {
  type    = string
  default = "dev-cluster"
}

variable "db_name" {
  type    = string
  default = "coredb"
}

variable "master_username" {
  type    = string
  default = "postgres"
  sensitive = true
}

variable "master_password" {
  type      = string
  default = "your_secure_password_here"
  sensitive = true
}
