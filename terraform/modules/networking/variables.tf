variable "env_prefix" {
  description = "The prefix used for all resource names"
  type        = string
}

variable "vpc_cidr" {
  type    = string
}

variable "region" {
  type = string
}

variable "public_subnet_a" {
  type = string
}

variable "public_subnet_b" {
  type = string
}

variable "private_subnet_a" {
  type = string
}

variable "private_subnet_b" {
  type = string
}

variable "cluster_name" {
  type    = string
  default = "dev-cluster"
}
