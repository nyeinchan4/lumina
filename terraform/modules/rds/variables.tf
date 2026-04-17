variable "vpc_id" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "identifier" {
  type    = string
  default = "dev-db"
}

variable "db_name" {
  type    = string
  default = "appdb"
}

variable "master_username" {
  type    = string
  default = "postgres"
}

variable "master_password" {
  type      = string
  sensitive = true
}

variable "engine_version" {
  type    = string
  default = "16.6"
}

variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}
