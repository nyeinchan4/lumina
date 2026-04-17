output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.vpc.id
}

output "private_subnet_a_id" {
  description = "The ID of the first private subnet"
  value       = aws_subnet.private_a.id
}

output "private_subnet_b_id" {
  description = "The ID of the second private subnet"
  value       = aws_subnet.private_b.id
}

output "private_subnet_ids" {
  description = "A list of IDs for the private subnets"
  value       = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

output "public_subnet_a_id" {
  description = "The ID of the first public subnet"
  value       = aws_subnet.public_a.id
}

output "public_subnet_b_id" {
  description = "The ID of the second public subnet"
  value       = aws_subnet.public_b.id
}
