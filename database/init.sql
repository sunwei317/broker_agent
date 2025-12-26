-- Broker Agent Database Initialization
-- This script runs automatically when the MySQL container starts for the first time

-- Create tables (these will also be created by SQLAlchemy, but having them here ensures proper encoding)
CREATE DATABASE IF NOT EXISTS broker_agent
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE broker_agent;

-- Grant privileges
GRANT ALL PRIVILEGES ON broker_agent.* TO 'broker'@'%';
FLUSH PRIVILEGES;

