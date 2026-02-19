-- MySQL dump 10.13  Distrib 5.7.17, for Win64 (x86_64)
--
-- Host: localhost    Database: 998877
-- ------------------------------------------------------
-- Server version	5.7.18-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accessories`
--

DROP TABLE IF EXISTS `accessories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accessories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(11) DEFAULT '0',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'قطعة',
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `min_stock` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accessories`
--

LOCK TABLES `accessories` WRITE;
/*!40000 ALTER TABLE `accessories` DISABLE KEYS */;
INSERT INTO `accessories` VALUES (1,'اكسسوار رقم 1','ACC-20260207080201-823',NULL,'ذهبي',NULL,0,'قطعة',5.00,'2026-02-07 06:02:13',10),(2,'اكسسوار رقم 2','335496787242',NULL,'فضي','',0,'قطعة',5.00,'2026-02-08 06:16:04',0);
/*!40000 ALTER TABLE `accessories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accessory_movements`
--

DROP TABLE IF EXISTS `accessory_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accessory_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `accessory_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `accessory_id` (`accessory_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accessory_movements`
--

LOCK TABLES `accessory_movements` WRITE;
/*!40000 ALTER TABLE `accessory_movements` DISABLE KEYS */;
INSERT INTO `accessory_movements` VALUES (1,1,3,'manufacturing',-5,100,95,4,'manufacturing_stage','{\"factory_product_id\":1,\"stage_id\":1,\"per_piece\":1,\"qty\":5,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"assign\",\"worker_id\":2,\"cutting_order_id\":4}',1,'2026-02-08 00:54:28'),(2,1,3,'manufacturing',-5,95,90,4,'manufacturing_stage','{\"factory_product_id\":1,\"stage_id\":1,\"per_piece\":1,\"qty\":5,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"assign\",\"worker_id\":2,\"cutting_order_id\":4}',1,'2026-02-08 00:59:16'),(3,1,3,'manufacturing',-5,90,85,3,'manufacturing_stage','{\"factory_product_id\":2,\"stage_id\":1,\"per_piece\":1,\"qty\":5,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"assign\",\"worker_id\":2,\"cutting_order_id\":3}',1,'2026-02-08 00:59:28'),(4,1,3,'manufacturing',-5,85,80,3,'manufacturing_stage','{\"factory_product_id\":2,\"stage_id\":2,\"per_piece\":1,\"qty\":5,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"transfer\",\"from_stage_id\":1,\"to_stage_id\":2,\"from_worker_id\":2,\"to_worker_id\":2}',1,'2026-02-08 01:06:04'),(5,1,3,'manufacturing',-5,80,75,3,'manufacturing_stage','{\"factory_product_id\":2,\"stage_id\":3,\"per_piece\":1,\"qty\":5,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"transfer\",\"from_stage_id\":2,\"to_stage_id\":3,\"from_worker_id\":2,\"to_worker_id\":2}',1,'2026-02-08 03:30:47'),(6,1,3,'manufacturing',-10,75,65,5,'manufacturing_stage','{\"factory_product_id\":1,\"stage_id\":1,\"per_piece\":1,\"qty\":10,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"assign\",\"worker_id\":2,\"cutting_order_id\":5}',1,'2026-02-08 03:57:07'),(7,1,3,'manufacturing',-10,65,55,1,'manufacturing_stage','{\"factory_product_id\":1,\"stage_id\":1,\"per_piece\":1,\"qty\":10,\"accessory_name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"accessory_code\":\"ACC-20260207080201-823\",\"action\":\"assign\",\"worker_id\":2,\"cutting_order_id\":1}',1,'2026-02-08 04:56:17'),(8,2,3,'purchase',100,0,100,71,'purchase_invoice','{\"id\":1770531341127,\"isNew\":true,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0641\\u0636\\u064a\",\"size\":\"\",\"costPrice\":5,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"335496787242\",\"productId\":\"\",\"itemType\":\"accessory_new\"}',1,'2026-02-08 06:16:04'),(9,1,3,'purchase',100,55,155,71,'purchase_invoice','{\"id\":1770531358253,\"itemType\":\"accessory_existing\",\"isNew\":false,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"color\":\"\\u0630\\u0647\\u0628\\u064a\",\"size\":\"\",\"costPrice\":5,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"ACC-20260207080201-823\",\"productId\":\"1\"}',1,'2026-02-08 06:16:04'),(10,1,3,'return_out',-5,155,150,75,'supplier_return','{\"id\":1770537289417,\"productId\":\"1\",\"qty\":5,\"costPrice\":5,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1 (\\u0630\\u0647\\u0628\\u064a--)\",\"returnType\":\"accessory\",\"total\":5}',1,'2026-02-08 07:55:03');
/*!40000 ALTER TABLE `accessory_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accessory_stock`
--

DROP TABLE IF EXISTS `accessory_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accessory_stock` (
  `accessory_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`accessory_id`,`warehouse_id`),
  KEY `fk_accessory_stock_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_accessory_stock_accessory` FOREIGN KEY (`accessory_id`) REFERENCES `accessories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_accessory_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accessory_stock`
--

LOCK TABLES `accessory_stock` WRITE;
/*!40000 ALTER TABLE `accessory_stock` DISABLE KEYS */;
INSERT INTO `accessory_stock` VALUES (1,3,150),(2,3,100);
/*!40000 ALTER TABLE `accessory_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('asset','liability','equity','income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts`
--

LOCK TABLES `accounts` WRITE;
/*!40000 ALTER TABLE `accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_daily_summary`
--

DROP TABLE IF EXISTS `attendance_daily_summary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_daily_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `work_date` date NOT NULL,
  `first_in` datetime DEFAULT NULL,
  `last_out` datetime DEFAULT NULL,
  `late_minutes` int(11) DEFAULT '0',
  `early_leave_minutes` int(11) DEFAULT '0',
  `overtime_minutes` int(11) DEFAULT '0',
  `is_absent` tinyint(1) DEFAULT '0',
  `status` enum('present','late','absent','leave','holiday') COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`work_date`),
  KEY `work_date` (`work_date`),
  KEY `shift_id` (`shift_id`),
  CONSTRAINT `attendance_daily_summary_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_daily_summary_ibfk_2` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_daily_summary`
--

LOCK TABLES `attendance_daily_summary` WRITE;
/*!40000 ALTER TABLE `attendance_daily_summary` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_daily_summary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_device_users`
--

DROP TABLE IF EXISTS `attendance_device_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_device_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_id` (`device_id`,`device_user_id`),
  UNIQUE KEY `device_id_2` (`device_id`,`employee_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `attendance_device_users_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `attendance_devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_device_users_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_device_users`
--

LOCK TABLES `attendance_device_users` WRITE;
/*!40000 ALTER TABLE `attendance_device_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_device_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_device_workers`
--

DROP TABLE IF EXISTS `attendance_device_workers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_device_workers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `worker_id` int(11) NOT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_id` (`device_id`,`device_user_id`),
  UNIQUE KEY `device_id_2` (`device_id`,`worker_id`),
  KEY `worker_id` (`worker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_device_workers`
--

LOCK TABLES `attendance_device_workers` WRITE;
/*!40000 ALTER TABLE `attendance_device_workers` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_device_workers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_devices`
--

DROP TABLE IF EXISTS `attendance_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` enum('hikvision','zkteco','adms','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `protocol` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'http',
  `driver` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_config` text COLLATE utf8mb4_unicode_ci,
  `ip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `port` int(11) DEFAULT '80',
  `serial_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `last_sync_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attendance_devices_vendor` (`vendor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_devices`
--

LOCK TABLES `attendance_devices` WRITE;
/*!40000 ALTER TABLE `attendance_devices` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_holidays`
--

DROP TABLE IF EXISTS `attendance_holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_holidays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `holiday_date` date NOT NULL,
  `is_paid` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_holidays`
--

LOCK TABLES `attendance_holidays` WRITE;
/*!40000 ALTER TABLE `attendance_holidays` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_logs`
--

DROP TABLE IF EXISTS `attendance_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_time` datetime NOT NULL,
  `direction` enum('in','out','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `raw_payload` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `device_id` (`device_id`),
  KEY `check_time` (`check_time`),
  CONSTRAINT `attendance_logs_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_logs_ibfk_2` FOREIGN KEY (`device_id`) REFERENCES `attendance_devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_logs`
--

LOCK TABLES `attendance_logs` WRITE;
/*!40000 ALTER TABLE `attendance_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_schedules`
--

DROP TABLE IF EXISTS `attendance_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `shift_id` int(11) NOT NULL,
  `day_of_week` tinyint(4) NOT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `shift_id` (`shift_id`),
  CONSTRAINT `attendance_schedules_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_schedules_ibfk_2` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_schedules`
--

LOCK TABLES `attendance_schedules` WRITE;
/*!40000 ALTER TABLE `attendance_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_shifts`
--

DROP TABLE IF EXISTS `attendance_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_shifts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_minutes` int(11) DEFAULT '0',
  `grace_in_minutes` int(11) DEFAULT '0',
  `grace_out_minutes` int(11) DEFAULT '0',
  `late_penalty_per_minute` decimal(10,2) DEFAULT '0.00',
  `early_leave_penalty_per_minute` decimal(10,2) DEFAULT '0.00',
  `absence_penalty_per_day` decimal(10,2) DEFAULT '0.00',
  `overtime_rate_per_hour` decimal(10,2) DEFAULT '0.00',
  `is_night_shift` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `weekly_off_days` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_shifts`
--

LOCK TABLES `attendance_shifts` WRITE;
/*!40000 ALTER TABLE `attendance_shifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_worker_daily_summary`
--

DROP TABLE IF EXISTS `attendance_worker_daily_summary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_worker_daily_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `work_date` date NOT NULL,
  `first_in` datetime DEFAULT NULL,
  `last_out` datetime DEFAULT NULL,
  `late_minutes` int(11) DEFAULT '0',
  `early_leave_minutes` int(11) DEFAULT '0',
  `overtime_minutes` int(11) DEFAULT '0',
  `is_absent` tinyint(1) DEFAULT '0',
  `status` enum('present','late','absent','leave','holiday') COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worker_id` (`worker_id`,`work_date`),
  KEY `work_date` (`work_date`),
  KEY `worker_id_2` (`worker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_worker_daily_summary`
--

LOCK TABLES `attendance_worker_daily_summary` WRITE;
/*!40000 ALTER TABLE `attendance_worker_daily_summary` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_worker_daily_summary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `module` (`module`),
  KEY `action` (`action`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'customers','archive',6,NULL,'127.0.0.1','2026-02-07 02:45:23'),(2,1,'customers','unarchive',6,NULL,'127.0.0.1','2026-02-07 02:45:29'),(3,1,'production_stages','create',1,'{\"fields\":[\"name\",\"order_num\",\"description\"]}','127.0.0.1','2026-02-07 06:02:27'),(4,1,'production_stages','create',2,'{\"fields\":[\"name\",\"order_num\",\"description\"]}','127.0.0.1','2026-02-07 06:02:37'),(5,1,'production_stages','create',3,'{\"fields\":[\"name\",\"order_num\",\"description\"]}','127.0.0.1','2026-02-07 06:02:45'),(6,1,'colors','create',1,'{\"fields\":[\"name\",\"code\"]}','127.0.0.1','2026-02-07 06:03:02'),(7,1,'colors','create',2,'{\"fields\":[\"name\",\"code\"]}','127.0.0.1','2026-02-07 06:03:11'),(8,1,'sizes','create',1,'{\"fields\":[\"name\",\"code\"]}','127.0.0.1','2026-02-07 06:04:14'),(9,1,'sizes','create',2,'{\"fields\":[\"name\",\"code\"]}','127.0.0.1','2026-02-07 06:04:22'),(10,1,'sizes','create',3,'{\"fields\":[\"name\",\"code\"]}','127.0.0.1','2026-02-07 06:04:31'),(11,1,'sizes','update',1,'{\"fields\":[\"name = ?\",\"code = ?\"]}','127.0.0.1','2026-02-07 06:04:38'),(12,1,'cutting_stage','add',1,'{\"code\":\"CUT-20260207080803-819\"}','127.0.0.1','2026-02-07 07:08:03'),(13,1,'cutting_stage','add',2,'{\"code\":\"CUT-20260207081253-710\"}','127.0.0.1','2026-02-07 07:12:53'),(14,1,'cutting_stage','add',3,'{\"code\":\"CUT-20260207081308-420\"}','127.0.0.1','2026-02-07 07:13:08'),(15,1,'cutting_stage','add',4,'{\"code\":\"CUT-20260207081623-418\"}','127.0.0.1','2026-02-07 07:16:23'),(16,1,'workers','create',1,'{\"fields\":[\"name\",\"job_title\",\"salary_type\",\"salary_amount\",\"hire_date\",\"phone\",\"status\"]}','127.0.0.1','2026-02-07 23:52:56'),(17,1,'workers','update',1,'{\"fields\":[\"name = ?\",\"job_title = ?\",\"salary_type = ?\",\"salary_amount = ?\",\"hire_date = ?\",\"phone = ?\",\"status = ?\"]}','127.0.0.1','2026-02-07 23:53:12'),(18,1,'workers','delete',1,NULL,'127.0.0.1','2026-02-07 23:53:17'),(19,1,'workers','create',2,'{\"fields\":[\"name\",\"job_title\",\"salary_type\",\"salary_amount\",\"hire_date\",\"phone\",\"fingerprint_no\",\"status\"]}','127.0.0.1','2026-02-08 00:53:57'),(20,1,'cutting_stage','add',5,'{\"code\":\"CUT-20260208045426-137\"}','127.0.0.1','2026-02-08 03:54:26'),(21,1,'sales_offices','create',1,'{\"fields\":[\"name\",\"phones\"]}','127.0.0.1','2026-02-08 06:25:18'),(22,1,'sales_offices','create',2,'{\"fields\":[\"name\",\"phones\"]}','127.0.0.1','2026-02-08 06:25:26'),(23,1,'sales_offices','update',2,'{\"fields\":[\"name = ?\",\"phones = ?\"]}','127.0.0.1','2026-02-08 06:31:40'),(24,1,'sales_offices','update',1,'{\"fields\":[\"name = ?\",\"phones = ?\"]}','127.0.0.1','2026-02-08 06:31:50'),(25,1,'sales_offices','delete',1,NULL,'127.0.0.1','2026-02-08 06:31:54'),(26,1,'sales_offices','create',3,'{\"fields\":[\"name\",\"phones\"]}','127.0.0.1','2026-02-08 06:32:42'),(27,1,'shipping_companies','create',1,'{\"fields\":[\"name\",\"phones\"]}','::1','2026-02-09 20:03:50'),(28,1,'users','create',3,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\"]}','::1','2026-02-11 16:12:14'),(29,1,'users','create',4,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\"]}','::1','2026-02-11 17:30:22'),(30,1,'users','create',5,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\"]}','::1','2026-02-11 17:36:04'),(31,1,'users','update',4,'{\"fields\":[\"name = ?\",\"role = ?\",\"phone = ?\",\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 17:56:54'),(32,1,'users','update',2,'{\"fields\":[\"name = ?\",\"role = ?\",\"phone = ?\",\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 17:57:02'),(33,1,'users','update',3,'{\"fields\":[\"name = ?\",\"role = ?\",\"phone = ?\",\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 17:57:09'),(34,1,'users','update',5,'{\"fields\":[\"name = ?\",\"role = ?\",\"phone = ?\",\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 17:57:16'),(35,1,'users','update',2,'{\"fields\":[\"name = ?\",\"role = ?\",\"phone = ?\",\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 17:57:22'),(36,1,'users','create',6,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:03:27'),(37,1,'transactions','create',76,'{\"type\":\"payment_in\",\"amount\":5000}','::1','2026-02-11 19:03:27'),(38,1,'users','create',7,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:12:55'),(39,1,'transactions','create',77,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:12:55'),(40,1,'users','delete',5,NULL,'::1','2026-02-11 19:17:23'),(41,1,'users','delete',6,NULL,'::1','2026-02-11 19:17:27'),(42,1,'users','delete',3,NULL,'::1','2026-02-11 19:17:30'),(43,1,'users','delete',7,NULL,'::1','2026-02-11 19:17:33'),(44,1,'users','delete',4,NULL,'::1','2026-02-11 19:17:36'),(45,1,'users','create',8,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:17:48'),(46,1,'transactions','create',78,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:17:49'),(47,1,'transactions','create',79,'{\"type\":\"payment_out\",\"amount\":-1000}','::1','2026-02-11 19:18:23'),(48,1,'users','delete',8,NULL,'::1','2026-02-11 19:19:00'),(49,1,'users','create',9,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:19:13'),(50,1,'transactions','create',80,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:19:13'),(51,1,'transactions','create',81,'{\"type\":\"payment_out\",\"amount\":-1000}','::1','2026-02-11 19:19:42'),(52,1,'users','delete',9,NULL,'::1','2026-02-11 19:20:54'),(53,1,'users','create',10,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:21:03'),(54,1,'transactions','create',82,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:21:03'),(55,1,'transactions','create',83,'{\"type\":\"payment_out\",\"amount\":-1000}','::1','2026-02-11 19:21:32'),(56,1,'users','delete',10,NULL,'::1','2026-02-11 19:22:36'),(57,1,'users','create',11,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:23:02'),(58,1,'transactions','create',84,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:23:02'),(59,1,'users','create',12,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:24:30'),(60,1,'transactions','create',85,'{\"type\":\"payment_in\",\"amount\":3000}','::1','2026-02-11 19:24:30'),(61,1,'transactions','create',86,'{\"type\":\"payment_out\",\"amount\":-1000}','::1','2026-02-11 19:24:59'),(62,1,'users','update',11,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 19:24:59'),(63,1,'transactions','create',87,'{\"type\":\"payment_out\",\"amount\":-3000}','::1','2026-02-11 19:25:59'),(64,1,'users','update',12,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 19:25:59'),(65,1,'users','delete',11,NULL,'::1','2026-02-11 19:26:28'),(66,1,'users','delete',12,NULL,'::1','2026-02-11 19:26:31'),(67,1,'users','create',13,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:34:00'),(68,1,'transactions','create',88,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:34:00'),(69,1,'users','create',14,'{\"fields\":[\"name\",\"username\",\"role\",\"phone\",\"password\",\"insurance_paid\",\"insurance_amount\"]}','::1','2026-02-11 19:34:00'),(70,1,'transactions','create',89,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:34:00'),(71,1,'transactions','create',90,'{\"type\":\"payment_in\",\"amount\":-1000}','::1','2026-02-11 19:34:19'),(72,1,'transactions','create',91,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-11 19:34:19'),(73,1,'users','update',14,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-11 19:34:19'),(74,1,'users','delete',14,NULL,'::1','2026-02-11 19:34:24'),(75,1,'sales','complete_daily',2,'{\"orders\":[30,31,32],\"total\":2970}','::1','2026-02-12 14:03:16'),(76,1,'orders','update',30,'{\"status\":\"returned\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-12 14:18:11'),(77,1,'sales','complete_daily',13,'{\"orders\":[14,15,16,17],\"total\":3020}','::1','2026-02-12 16:40:25'),(78,1,'orders','update',14,'{\"status\":\"returned\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-12 16:40:50'),(79,1,'orders','update',16,'{\"status\":\"in_delivery\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-12 16:40:59'),(80,1,'orders','update',15,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-12 16:41:07'),(81,1,'orders','update',17,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-12 16:41:07'),(82,1,'sales','complete_daily',2,'{\"orders\":[32,31],\"total\":1980}','::1','2026-02-12 17:45:38'),(83,1,'transactions','create',111,'{\"type\":\"payment_in\",\"amount\":50000}','::1','2026-02-12 18:36:55'),(84,1,'transactions','create',112,'{\"type\":\"payment_in\",\"amount\":-2670}','::1','2026-02-12 18:41:47'),(85,1,'transactions','create',113,'{\"type\":\"payment_in\",\"amount\":1000}','::1','2026-02-12 18:41:47'),(86,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 18:41:47'),(87,1,'transactions','create',114,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:44:17'),(88,1,'transactions','create',115,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:44:44'),(89,1,'transactions','create',116,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:46:05'),(90,1,'transactions','create',117,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:49:22'),(91,1,'transactions','create',118,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:50:08'),(92,1,'transactions','create',119,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:52:38'),(93,1,'transactions','create',120,'{\"type\":\"payment_in\",\"amount\":-670}','::1','2026-02-12 18:55:27'),(94,1,'transactions','create',121,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:57:03'),(95,1,'transactions','create',122,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:57:47'),(96,1,'transactions','create',123,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 18:58:44'),(97,1,'transactions','create',124,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 19:19:13'),(98,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 19:19:13'),(99,1,'transactions','create',125,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 19:22:54'),(100,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 19:22:54'),(101,1,'transactions','create',126,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 21:39:55'),(102,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 21:39:55'),(103,1,'transactions','create',127,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 21:40:44'),(104,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 21:40:45'),(105,1,'transactions','create',128,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 22:17:02'),(106,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 22:17:02'),(107,1,'transactions','create',129,'{\"type\":\"payment_in\",\"amount\":-1670}','::1','2026-02-12 22:23:49'),(108,1,'users','update',13,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-12 22:23:49'),(109,1,'sales','complete_daily',13,'{\"orders\":[28,27,26,29],\"total\":3760}','::1','2026-02-13 10:59:49'),(110,1,'orders','update',27,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:00:26'),(111,1,'orders','update',26,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:00:26'),(112,1,'orders','update',29,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:00:26'),(113,1,'orders','update',28,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:00:26'),(114,1,'orders','update',31,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:01:04'),(115,1,'orders','update',32,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:01:04'),(116,1,'sales','complete_daily',13,'{\"orders\":[18,19,20],\"total\":2670}','::1','2026-02-13 11:15:11'),(117,1,'orders','update',18,'{\"status\":\"in_delivery\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:16:01'),(118,1,'orders','update',19,'{\"status\":\"in_delivery\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:16:18'),(119,1,'orders','update',20,'{\"status\":\"delivered\",\"rep_id\":null,\"shipping_company_id\":null}','::1','2026-02-13 11:16:32'),(120,1,'transactions','create',135,'{\"type\":\"payment_in\",\"amount\":50000}','::1','2026-02-13 12:22:23'),(121,1,'transactions','create',136,'{\"type\":\"payment_in\",\"amount\":-36632}','::1','2026-02-13 12:22:44'),(122,1,'users','update',2,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-13 12:22:44'),(123,1,'transactions','create',137,'{\"type\":\"payment_in\",\"amount\":50000}','::1','2026-02-13 12:54:57'),(124,1,'transactions','create',138,'{\"type\":\"payment_in\",\"amount\":-34632}','::1','2026-02-13 12:55:21'),(125,1,'users','update',2,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-13 12:55:21'),(126,1,'transactions','create',139,'{\"type\":\"payment_in\",\"amount\":-34632}','::1','2026-02-13 13:04:41'),(127,1,'users','update',2,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-13 13:04:41'),(128,1,'transactions','create',140,'{\"type\":\"payment_in\",\"amount\":100000}','::1','2026-02-13 13:09:47'),(129,1,'transactions','create',141,'{\"type\":\"payment_in\",\"amount\":-34632}','::1','2026-02-13 13:10:16'),(130,1,'users','update',2,'{\"fields\":[\"insurance_paid = ?\",\"insurance_amount = ?\"]}','::1','2026-02-13 13:10:16');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backup_email_otps`
--

DROP TABLE IF EXISTS `backup_email_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backup_email_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backup_email_otps`
--

LOCK TABLES `backup_email_otps` WRITE;
/*!40000 ALTER TABLE `backup_email_otps` DISABLE KEYS */;
INSERT INTO `backup_email_otps` VALUES (1,1,'mamdouh.hisham89@gmail.com','507599','2026-02-06 19:03:57','2026-02-06 20:13:57','2026-02-06 21:04:30');
/*!40000 ALTER TABLE `backup_email_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `colors`
--

DROP TABLE IF EXISTS `colors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `colors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `colors`
--

LOCK TABLES `colors` WRITE;
/*!40000 ALTER TABLE `colors` DISABLE KEYS */;
INSERT INTO `colors` VALUES (1,'اسود','اسود','2026-02-07 06:03:02'),(2,'ايبض','ابيض','2026-02-07 06:03:11');
/*!40000 ALTER TABLE `colors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `composite_product_items`
--

DROP TABLE IF EXISTS `composite_product_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `composite_product_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `composite_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `composite_id` (`composite_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `composite_product_items_ibfk_1` FOREIGN KEY (`composite_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `composite_product_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `composite_product_items`
--

LOCK TABLES `composite_product_items` WRITE;
/*!40000 ALTER TABLE `composite_product_items` DISABLE KEYS */;
INSERT INTO `composite_product_items` VALUES (1,4,1,1),(2,4,3,1),(3,4,2,1);
/*!40000 ALTER TABLE `composite_product_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_interactions`
--

DROP TABLE IF EXISTS `customer_interactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `interaction_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  KEY `created_at` (`created_at`),
  CONSTRAINT `customer_interactions_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_interactions`
--

LOCK TABLES `customer_interactions` WRITE;
/*!40000 ALTER TABLE `customer_interactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_interactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone1` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone2` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `governorate` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landmark` text COLLATE utf8mb4_unicode_ci,
  `total_debit` decimal(15,2) DEFAULT '0.00',
  `total_credit` decimal(15,2) DEFAULT '0.00',
  `is_archived` tinyint(1) DEFAULT '0',
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (2,'عميل جديد','10561651','1561','5601','561056','604',0.00,0.00,0,NULL),(6,'رحاب','01204511159','','مركز ديرب نجم قريه صفط زريق','الشرقيه','',920.00,0.00,0,NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cutting_orders`
--

DROP TABLE IF EXISTS `cutting_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cutting_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `fabric_id` int(11) NOT NULL,
  `factory_product_id` int(11) NOT NULL,
  `cut_quantity` int(11) NOT NULL,
  `consumption_per_piece` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `total_consumption` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `available_qty` int(11) NOT NULL DEFAULT '0',
  `in_production_qty` int(11) NOT NULL DEFAULT '0',
  `ready_qty` int(11) NOT NULL DEFAULT '0',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `fabric_id` (`fabric_id`),
  KEY `factory_product_id` (`factory_product_id`),
  KEY `created_at` (`created_at`),
  KEY `warehouse_id` (`warehouse_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cutting_orders`
--

LOCK TABLES `cutting_orders` WRITE;
/*!40000 ALTER TABLE `cutting_orders` DISABLE KEYS */;
INSERT INTO `cutting_orders` VALUES (1,'CUT-20260207080803-819',3,1,1,10,1.0000,10.0000,0,0,10,1,'2026-02-07 07:08:03'),(2,'CUT-20260207081253-710',3,1,3,20,1.0000,20.0000,20,0,0,1,'2026-02-07 07:12:53'),(3,'CUT-20260207081308-420',3,1,2,5,1.0000,5.0000,0,0,5,1,'2026-02-07 07:13:08'),(4,'CUT-20260207081623-418',3,1,1,10,2.0000,20.0000,0,0,10,1,'2026-02-07 07:16:23'),(5,'CUT-20260208045426-137',3,1,1,10,1.0000,10.0000,0,0,10,1,'2026-02-08 03:54:26');
/*!40000 ALTER TABLE `cutting_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dispatch_order_items`
--

DROP TABLE IF EXISTS `dispatch_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dispatch_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `factory_product_id` int(11) NOT NULL,
  `qty_sent` int(11) NOT NULL,
  `qty_received` int(11) DEFAULT NULL,
  `size_id` int(11) NOT NULL DEFAULT '0',
  `color` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_order_variant` (`order_id`,`factory_product_id`,`size_id`,`color`),
  KEY `order_id` (`order_id`),
  KEY `factory_product_id` (`factory_product_id`),
  KEY `size_id` (`size_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dispatch_order_items`
--

LOCK TABLES `dispatch_order_items` WRITE;
/*!40000 ALTER TABLE `dispatch_order_items` DISABLE KEYS */;
INSERT INTO `dispatch_order_items` VALUES (1,1,1,55,55,0,''),(2,1,3,20,20,0,''),(3,1,2,7,7,0,''),(4,2,1,12,10,3,'اسود'),(5,3,1,5,5,3,'اسود'),(6,4,2,10,10,3,'اسود'),(7,5,4,8,8,3,'اسود');
/*!40000 ALTER TABLE `dispatch_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dispatch_orders`
--

DROP TABLE IF EXISTS `dispatch_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dispatch_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_warehouse_id` int(11) NOT NULL,
  `to_warehouse_id` int(11) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_dispatch_orders_code` (`code`),
  KEY `from_warehouse_id` (`from_warehouse_id`),
  KEY `to_warehouse_id` (`to_warehouse_id`),
  KEY `status` (`status`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dispatch_orders`
--

LOCK TABLES `dispatch_orders` WRITE;
/*!40000 ALTER TABLE `dispatch_orders` DISABLE KEYS */;
INSERT INTO `dispatch_orders` VALUES (1,'DSP-20260208-00001',3,2,'confirmed',NULL,1,'2026-02-08 02:58:21',1,'2026-02-08 04:58:33','2026-02-08 02:58:33'),(2,'DSP-20260208-00002',3,2,'mismatch',NULL,1,'2026-02-08 03:58:14',1,'2026-02-08 06:10:37','2026-02-08 04:10:37'),(3,'DSP-20260208-00003',3,2,'confirmed',NULL,1,'2026-02-08 04:22:28',1,'2026-02-08 06:22:44','2026-02-08 04:22:44'),(4,'DSP-20260208-00004',3,2,'confirmed',NULL,1,'2026-02-08 04:43:31',1,'2026-02-08 06:43:49','2026-02-08 04:43:49'),(5,'DSP-20260208-00005',3,2,'confirmed',NULL,1,'2026-02-08 05:15:20',1,'2026-02-08 07:15:30','2026-02-08 05:15:30');
/*!40000 ALTER TABLE `dispatch_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dispatches`
--

DROP TABLE IF EXISTS `dispatches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dispatches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `factory_product_id` (`factory_product_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_at` (`created_at`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `dispatches_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dispatches_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `dispatches_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dispatches`
--

LOCK TABLES `dispatches` WRITE;
/*!40000 ALTER TABLE `dispatches` DISABLE KEYS */;
/*!40000 ALTER TABLE `dispatches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_advances`
--

DROP TABLE IF EXISTS `employee_advances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_advances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','loan') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `employee_advances_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_advances`
--

LOCK TABLES `employee_advances` WRITE;
/*!40000 ALTER TABLE `employee_advances` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_advances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_salaries`
--

DROP TABLE IF EXISTS `employee_salaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_salaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `month` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_salary` decimal(10,2) NOT NULL,
  `deductions` decimal(10,2) DEFAULT '0.00',
  `bonuses` decimal(10,2) DEFAULT '0.00',
  `net_salary` decimal(10,2) NOT NULL,
  `status` enum('pending','paid') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`month`),
  CONSTRAINT `employee_salaries_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_salaries`
--

LOCK TABLES `employee_salaries` WRITE;
/*!40000 ALTER TABLE `employee_salaries` DISABLE KEYS */;
INSERT INTO `employee_salaries` VALUES (1,2,'2026-02',25000.00,0.00,0.00,25000.00,'pending','2026-02-04 05:18:40',NULL);
/*!40000 ALTER TABLE `employee_salaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_transactions`
--

DROP TABLE IF EXISTS `employee_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','bonus','penalty','salary') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `treasury_id` (`treasury_id`),
  CONSTRAINT `employee_transactions_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_transactions_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_transactions`
--

LOCK TABLES `employee_transactions` WRITE;
/*!40000 ALTER TABLE `employee_transactions` DISABLE KEYS */;
INSERT INTO `employee_transactions` VALUES (1,2,2,500.00,'advance','2026-02-04','','deducted','2026-02-04 01:10:47');
/*!40000 ALTER TABLE `employee_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','on_leave') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attendance_enabled` tinyint(1) DEFAULT '1',
  `default_shift_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (2,'موظف رقم 1','مدير نظام',25000.00,'2026-02-04','01150006289','active','2026-02-04 00:53:33',1,NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fabric_movements`
--

DROP TABLE IF EXISTS `fabric_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fabric_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fabric_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` decimal(10,4) NOT NULL,
  `previous_quantity` decimal(10,4) NOT NULL,
  `new_quantity` decimal(10,4) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fabric_id` (`fabric_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_at` (`created_at`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `fabric_movements_ibfk_1` FOREIGN KEY (`fabric_id`) REFERENCES `fabrics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fabric_movements_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fabric_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fabric_movements`
--

LOCK TABLES `fabric_movements` WRITE;
/*!40000 ALTER TABLE `fabric_movements` DISABLE KEYS */;
INSERT INTO `fabric_movements` VALUES (1,1,3,'cutting_order',-10.0000,80.0000,70.0000,5,'cutting_order','{\"cutting_order_id\":5,\"cutting_order_code\":\"CUT-20260208045426-137\",\"factory_product_id\":1,\"cut_quantity\":10,\"consumption_per_piece\":1,\"total_consumption\":10}',1,'2026-02-08 03:54:26'),(2,1,3,'purchase',10.0000,70.0000,80.0000,69,'purchase_invoice','{\"id\":1770531315053,\"itemType\":\"fabric_existing\",\"isNew\":false,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"\",\"costPrice\":150,\"sellingPrice\":0,\"qty\":10,\"barcode\":\"FAB-20260207074811-364\",\"productId\":\"1\"}',1,'2026-02-08 06:15:25'),(3,2,3,'purchase',100.0000,0.0000,100.0000,70,'purchase_invoice','{\"id\":1770531325311,\"isNew\":true,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0627\\u0628\\u064a\\u0636\",\"size\":\"\",\"costPrice\":10,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"273403218295\",\"productId\":\"\",\"itemType\":\"fabric_new\"}',1,'2026-02-08 06:15:40'),(4,1,3,'return_out',-30.0000,80.0000,50.0000,73,'supplier_return','{\"id\":1770531315053,\"productId\":\"1\",\"qty\":30,\"costPrice\":150,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f (\\u0627\\u0633\\u0648\\u062f--)\",\"returnType\":\"fabric\",\"total\":150}',1,'2026-02-08 06:16:54'),(5,1,3,'return_out',-10.0000,50.0000,40.0000,75,'supplier_return','{\"id\":1770537280414,\"productId\":\"1\",\"qty\":10,\"costPrice\":150,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f (\\u0627\\u0633\\u0648\\u062f--)\",\"returnType\":\"fabric\",\"total\":150}',1,'2026-02-08 07:55:03');
/*!40000 ALTER TABLE `fabric_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fabric_stock`
--

DROP TABLE IF EXISTS `fabric_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fabric_stock` (
  `fabric_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` decimal(10,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`fabric_id`,`warehouse_id`),
  KEY `fk_fabric_stock_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_fabric_stock_fabric` FOREIGN KEY (`fabric_id`) REFERENCES `fabrics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fabric_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fabric_stock`
--

LOCK TABLES `fabric_stock` WRITE;
/*!40000 ALTER TABLE `fabric_stock` DISABLE KEYS */;
INSERT INTO `fabric_stock` VALUES (1,3,40.0000),(2,3,100.0000);
/*!40000 ALTER TABLE `fabric_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fabrics`
--

DROP TABLE IF EXISTS `fabrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fabrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `material` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(11) DEFAULT '0',
  `min_stock` int(1) DEFAULT '0',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'متر',
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fabrics`
--

LOCK TABLES `fabrics` WRITE;
/*!40000 ALTER TABLE `fabrics` DISABLE KEYS */;
INSERT INTO `fabrics` VALUES (1,'قماش جديد','FAB-20260207074811-364','اسود',NULL,NULL,0,10,'متر',150.00,'2026-02-07 05:48:22'),(2,'قماش رقم 2','273403218295','ابيض','',NULL,0,0,'متر',10.00,'2026-02-08 06:15:40');
/*!40000 ALTER TABLE `fabrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_product_movements`
--

DROP TABLE IF EXISTS `factory_product_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_product_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `factory_product_id` (`factory_product_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_product_movements`
--

LOCK TABLES `factory_product_movements` WRITE;
/*!40000 ALTER TABLE `factory_product_movements` DISABLE KEYS */;
INSERT INTO `factory_product_movements` VALUES (1,1,3,'manufacturing_finish',5,50,55,4,'cutting_order','{\"cutting_order_id\":4,\"stage_id\":3,\"qty\":5,\"unit_cost\":305,\"fabric_unit_cost\":300,\"accessories_unit_cost\":5,\"wage_unit_cost\":0}',1,'2026-02-08 00:58:02'),(2,1,3,'send_to_sales',-55,55,0,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":55,\"qty_received\":55}',1,'2026-02-08 02:58:33'),(3,1,2,'receive_from_factory',55,0,55,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":55,\"qty_received\":55}',1,'2026-02-08 02:58:33'),(4,3,3,'send_to_sales',-20,30,10,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":20,\"qty_received\":20}',1,'2026-02-08 02:58:33'),(5,3,2,'receive_from_factory',20,0,20,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":20,\"qty_received\":20}',1,'2026-02-08 02:58:33'),(6,2,3,'send_to_sales',-7,20,13,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":7,\"qty_received\":7}',1,'2026-02-08 02:58:33'),(7,2,2,'receive_from_factory',7,0,7,1,'dispatch_order','{\"dispatch_order_id\":1,\"dispatch_code\":\"DSP-20260208-00001\",\"qty_sent\":7,\"qty_received\":7}',1,'2026-02-08 02:58:33'),(8,1,3,'manufacturing_finish',5,0,5,4,'cutting_order','{\"cutting_order_id\":4,\"stage_id\":3,\"qty\":5,\"unit_cost\":325,\"fabric_unit_cost\":300,\"accessories_unit_cost\":5,\"wage_unit_cost\":20}',1,'2026-02-08 03:30:37'),(9,2,3,'manufacturing_finish',1,13,14,3,'cutting_order','{\"cutting_order_id\":3,\"stage_id\":3,\"qty\":1,\"unit_cost\":185,\"fabric_unit_cost\":150,\"accessories_unit_cost\":15,\"wage_unit_cost\":20}',1,'2026-02-08 03:30:51'),(10,2,3,'manufacturing_finish',4,14,18,3,'cutting_order','{\"cutting_order_id\":3,\"stage_id\":3,\"qty\":4,\"unit_cost\":185,\"fabric_unit_cost\":150,\"accessories_unit_cost\":15,\"wage_unit_cost\":20}',1,'2026-02-08 03:31:03'),(11,1,3,'manufacturing_finish',10,5,15,5,'cutting_order','{\"cutting_order_id\":5,\"stage_id\":3,\"qty\":10,\"unit_cost\":155,\"fabric_unit_cost\":150,\"accessories_unit_cost\":5,\"wage_unit_cost\":0}',1,'2026-02-08 03:57:35'),(12,1,3,'send_to_sales',-10,15,5,2,'dispatch_order','{\"dispatch_order_id\":2,\"dispatch_code\":\"DSP-20260208-00002\",\"qty_sent\":12,\"qty_received\":10}',1,'2026-02-08 04:10:37'),(13,1,2,'receive_from_factory',10,55,65,2,'dispatch_order','{\"dispatch_order_id\":2,\"dispatch_code\":\"DSP-20260208-00002\",\"qty_sent\":12,\"qty_received\":10}',1,'2026-02-08 04:10:37'),(14,1,3,'send_to_sales',-5,5,0,3,'dispatch_order','{\"dispatch_order_id\":3,\"dispatch_code\":\"DSP-20260208-00003\",\"qty_sent\":5,\"qty_received\":5}',1,'2026-02-08 04:22:44'),(15,1,2,'receive_from_factory',5,65,70,3,'dispatch_order','{\"dispatch_order_id\":3,\"dispatch_code\":\"DSP-20260208-00003\",\"qty_sent\":5,\"qty_received\":5}',1,'2026-02-08 04:22:44'),(16,2,3,'send_to_sales',-10,18,8,4,'dispatch_order','{\"dispatch_order_id\":4,\"dispatch_code\":\"DSP-20260208-00004\",\"qty_sent\":10,\"qty_received\":10}',1,'2026-02-08 04:43:49'),(17,1,3,'manufacturing_finish',10,0,10,1,'cutting_order','{\"cutting_order_id\":1,\"stage_id\":3,\"qty\":10,\"unit_cost\":155,\"fabric_unit_cost\":150,\"accessories_unit_cost\":5,\"wage_unit_cost\":0}',1,'2026-02-08 04:56:38'),(18,1,3,'assembly_use',-8,10,2,4,'assembly','{\"action\":\"assembleComposite\",\"composite_id\":4,\"quantity\":8,\"per_unit\":1,\"qty_used\":8}',1,'2026-02-08 04:57:06'),(19,3,3,'assembly_use',-8,10,2,4,'assembly','{\"action\":\"assembleComposite\",\"composite_id\":4,\"quantity\":8,\"per_unit\":1,\"qty_used\":8}',1,'2026-02-08 04:57:06'),(20,2,3,'assembly_use',-8,8,0,4,'assembly','{\"action\":\"assembleComposite\",\"composite_id\":4,\"quantity\":8,\"per_unit\":1,\"qty_used\":8}',1,'2026-02-08 04:57:06'),(21,4,3,'assembly_build',8,0,8,4,'assembly','{\"action\":\"assembleComposite\",\"composite_id\":4,\"quantity\":8,\"unit_cost\":340,\"total_cost\":2720,\"components\":[{\"product_id\":1,\"name\":\"\\u0628\\u0646\\u0637\\u0644\\u0648\\u0646\",\"code\":\"PRD-20260207084230-817\",\"per_unit\":1,\"qty_used\":8,\"unit_cost\":155},{\"product_id\":3,\"name\":\"\\u062c\\u0627\\u0643\\u062a\",\"code\":\"PRD-20260207084409-329\",\"per_unit\":1,\"qty_used\":8,\"unit_cost\":0},{\"product_id\":2,\"name\":\"\\u0642\\u0645\\u064a\\u0635\",\"code\":\"PRD-20260207084322-142\",\"per_unit\":1,\"qty_used\":8,\"unit_cost\":185}]}',1,'2026-02-08 04:57:06'),(22,4,3,'send_to_sales',-8,8,0,5,'dispatch_order','{\"dispatch_order_id\":5,\"dispatch_code\":\"DSP-20260208-00005\",\"qty_sent\":8,\"qty_received\":8}',1,'2026-02-08 05:15:30');
/*!40000 ALTER TABLE `factory_product_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_product_sizes`
--

DROP TABLE IF EXISTS `factory_product_sizes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_product_sizes` (
  `factory_product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL,
  PRIMARY KEY (`factory_product_id`,`size_id`),
  KEY `size_id` (`size_id`),
  CONSTRAINT `factory_product_sizes_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_sizes_ibfk_2` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_product_sizes`
--

LOCK TABLES `factory_product_sizes` WRITE;
/*!40000 ALTER TABLE `factory_product_sizes` DISABLE KEYS */;
INSERT INTO `factory_product_sizes` VALUES (1,1),(2,1),(3,1),(1,2),(2,2),(3,2),(1,3),(2,3),(3,3);
/*!40000 ALTER TABLE `factory_product_sizes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_product_stage_accessories`
--

DROP TABLE IF EXISTS `factory_product_stage_accessories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_product_stage_accessories` (
  `factory_product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `accessory_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (`factory_product_id`,`stage_id`,`accessory_id`),
  KEY `stage_id` (`stage_id`),
  KEY `accessory_id` (`accessory_id`),
  CONSTRAINT `factory_product_stage_accessories_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stage_accessories_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stage_accessories_ibfk_3` FOREIGN KEY (`accessory_id`) REFERENCES `accessories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_product_stage_accessories`
--

LOCK TABLES `factory_product_stage_accessories` WRITE;
/*!40000 ALTER TABLE `factory_product_stage_accessories` DISABLE KEYS */;
INSERT INTO `factory_product_stage_accessories` VALUES (1,1,1,1),(2,1,1,1),(2,2,1,1),(2,3,1,1),(3,1,1,2),(3,2,1,5);
/*!40000 ALTER TABLE `factory_product_stage_accessories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_product_stages`
--

DROP TABLE IF EXISTS `factory_product_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_product_stages` (
  `factory_product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  PRIMARY KEY (`factory_product_id`,`stage_id`),
  KEY `stage_id` (`stage_id`),
  CONSTRAINT `factory_product_stages_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stages_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_product_stages`
--

LOCK TABLES `factory_product_stages` WRITE;
/*!40000 ALTER TABLE `factory_product_stages` DISABLE KEYS */;
INSERT INTO `factory_product_stages` VALUES (1,1),(2,1),(3,1),(1,2),(2,2),(3,2),(1,3),(2,3);
/*!40000 ALTER TABLE `factory_product_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_products`
--

DROP TABLE IF EXISTS `factory_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('individual','composite') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sale_price` decimal(10,2) DEFAULT '0.00',
  `min_stock` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_products`
--

LOCK TABLES `factory_products` WRITE;
/*!40000 ALTER TABLE `factory_products` DISABLE KEYS */;
INSERT INTO `factory_products` VALUES (1,'بنطلون','PRD-20260207084230-817','individual',NULL,'2026-02-07 06:43:18',150.00,5),(2,'قميص','PRD-20260207084322-142','individual','قميص','2026-02-07 06:44:04',150.00,5),(3,'جاكت','PRD-20260207084409-329','individual','جاكت جلد','2026-02-07 06:44:48',100.00,10),(4,'بدله','PRD-20260207084450-549','composite',NULL,'2026-02-07 06:45:13',750.00,5);
/*!40000 ALTER TABLE `factory_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_receiving`
--

DROP TABLE IF EXISTS `factory_receiving`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_receiving` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `received_by` int(11) DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `factory_receiving_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `manufacturing_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_receiving`
--

LOCK TABLES `factory_receiving` WRITE;
/*!40000 ALTER TABLE `factory_receiving` DISABLE KEYS */;
/*!40000 ALTER TABLE `factory_receiving` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factory_stock`
--

DROP TABLE IF EXISTS `factory_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factory_stock` (
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`factory_product_id`,`warehouse_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `factory_stock_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_stock_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factory_stock`
--

LOCK TABLES `factory_stock` WRITE;
/*!40000 ALTER TABLE `factory_stock` DISABLE KEYS */;
INSERT INTO `factory_stock` VALUES (1,2,70),(1,3,2),(2,2,7),(2,3,0),(3,2,20),(3,3,2),(4,3,0);
/*!40000 ALTER TABLE `factory_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_audit_items`
--

DROP TABLE IF EXISTS `inventory_audit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_audit_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `audit_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `system_qty` int(11) NOT NULL DEFAULT '0',
  `counted_qty` int(11) NOT NULL DEFAULT '0',
  `diff_qty` int(11) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_audit_product` (`audit_id`,`product_id`),
  KEY `audit_id` (`audit_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `inventory_audit_items_ibfk_1` FOREIGN KEY (`audit_id`) REFERENCES `inventory_audits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_audit_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_audit_items`
--

LOCK TABLES `inventory_audit_items` WRITE;
/*!40000 ALTER TABLE `inventory_audit_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_audit_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_audits`
--

DROP TABLE IF EXISTS `inventory_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_audits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `status` enum('draft','pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `inventory_audits_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_audits`
--

LOCK TABLES `inventory_audits` WRITE;
/*!40000 ALTER TABLE `inventory_audits` DISABLE KEYS */;
INSERT INTO `inventory_audits` VALUES (1,3,'draft','',NULL,1,'2026-02-07 02:41:32',NULL,NULL,NULL),(2,3,'draft','',NULL,1,'2026-02-07 02:41:47',NULL,NULL,NULL),(3,2,'draft','',NULL,1,'2026-02-07 02:42:30',NULL,NULL,NULL),(4,3,'pending','',NULL,1,'2026-02-07 02:42:44','2026-02-07 04:42:55',NULL,NULL),(5,3,'draft','',NULL,1,'2026-02-07 04:01:12',NULL,NULL,NULL),(6,3,'draft','',NULL,1,'2026-02-08 03:09:02',NULL,NULL,NULL);
/*!40000 ALTER TABLE `inventory_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_entries`
--

DROP TABLE IF EXISTS `journal_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `journal_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_date` date NOT NULL,
  `memo` text COLLATE utf8mb4_unicode_ci,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` int(11) DEFAULT NULL,
  `posted` tinyint(1) DEFAULT '0',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `source_type` (`source_type`,`source_id`),
  KEY `entry_date` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_entries`
--

LOCK TABLES `journal_entries` WRITE;
/*!40000 ALTER TABLE `journal_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_lines`
--

DROP TABLE IF EXISTS `journal_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `journal_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `debit` decimal(15,2) DEFAULT '0.00',
  `credit` decimal(15,2) DEFAULT '0.00',
  `line_memo` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `entry_id` (`entry_id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `journal_lines_ibfk_1` FOREIGN KEY (`entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `journal_lines_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_lines`
--

LOCK TABLES `journal_lines` WRITE;
/*!40000 ALTER TABLE `journal_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manufacturing_order_stages`
--

DROP TABLE IF EXISTS `manufacturing_order_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `manufacturing_order_stages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `stage_id` (`stage_id`),
  KEY `worker_id` (`worker_id`),
  CONSTRAINT `manufacturing_order_stages_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `manufacturing_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manufacturing_order_stages_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`),
  CONSTRAINT `manufacturing_order_stages_ibfk_3` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manufacturing_order_stages`
--

LOCK TABLES `manufacturing_order_stages` WRITE;
/*!40000 ALTER TABLE `manufacturing_order_stages` DISABLE KEYS */;
/*!40000 ALTER TABLE `manufacturing_order_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manufacturing_orders`
--

DROP TABLE IF EXISTS `manufacturing_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `manufacturing_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cutting_order_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `status` enum('draft','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `manufacturing_orders_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manufacturing_orders`
--

LOCK TABLES `manufacturing_orders` WRITE;
/*!40000 ALTER TABLE `manufacturing_orders` DISABLE KEYS */;
INSERT INTO `manufacturing_orders` VALUES (1,4,1,10,'in_progress',NULL,1,'2026-02-08 00:54:28'),(2,3,2,5,'in_progress',NULL,1,'2026-02-08 00:59:28'),(3,5,1,10,'in_progress',NULL,1,'2026-02-08 03:57:07'),(4,1,1,10,'in_progress',NULL,1,'2026-02-08 04:56:17');
/*!40000 ALTER TABLE `manufacturing_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_documents`
--

DROP TABLE IF EXISTS `order_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `doc_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doc_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `order_documents_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_documents`
--

LOCK TABLES `order_documents` WRITE;
/*!40000 ALTER TABLE `order_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,4,4,1,0.00),(2,4,4,1,0.00),(3,4,6,1,0.00),(4,6,4,1,0.00),(5,6,4,1,0.00),(6,6,6,1,0.00),(7,7,4,1,350.00),(8,7,4,1,350.00),(9,7,6,1,6.00),(10,8,4,1,350.00),(11,8,4,1,350.00),(12,8,6,1,6.00),(13,9,4,1,350.00),(14,9,4,1,350.00),(15,9,6,1,6.00),(16,10,4,1,350.00),(17,10,1,1,200.00),(18,11,4,1,350.00),(19,11,4,1,350.00),(20,11,6,1,6.00),(21,12,6,5,300.00),(22,13,4,1,350.00),(23,13,4,1,350.00),(24,13,6,1,300.00),(25,14,4,1,350.00),(26,15,4,1,350.00),(27,15,4,1,350.00),(28,15,6,1,300.00),(29,16,4,1,350.00),(30,16,4,1,350.00),(31,16,6,1,300.00),(32,17,4,1,350.00),(33,17,4,1,350.00),(34,17,6,1,300.00),(35,18,4,1,350.00),(36,18,4,1,350.00),(37,18,6,1,300.00),(38,19,4,1,350.00),(39,19,4,1,350.00),(40,19,6,1,300.00),(41,20,4,1,350.00),(42,20,4,1,350.00),(43,20,6,1,300.00),(44,21,4,1,350.00),(45,21,4,1,350.00),(46,21,6,1,300.00),(47,22,4,1,350.00),(48,22,4,1,350.00),(49,22,6,1,300.00),(50,23,4,1,350.00),(51,23,4,1,350.00),(52,23,8,1,750.00),(53,23,6,1,300.00),(54,24,4,1,350.00),(55,24,4,1,350.00),(56,24,6,1,300.00),(57,25,4,2,250.00),(58,25,6,1,150.00),(59,26,4,1,500.00),(60,27,4,2,20.00),(61,27,6,1,40.00),(62,28,4,1,250.00),(63,28,4,1,250.00),(64,28,6,1,350.00),(65,29,4,1,250.00),(66,29,4,1,250.00),(67,29,6,1,350.00),(68,30,4,1,250.00),(69,30,4,1,250.00),(70,30,6,1,350.00),(71,31,4,1,250.00),(72,31,4,1,250.00),(73,31,6,1,350.00),(74,32,4,1,250.00),(75,32,4,1,250.00),(76,32,6,1,350.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_status_history`
--

DROP TABLE IF EXISTS `order_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rep_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `status` (`status`),
  CONSTRAINT `order_status_history_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_status_history`
--

LOCK TABLES `order_status_history` WRITE;
/*!40000 ALTER TABLE `order_status_history` DISABLE KEYS */;
INSERT INTO `order_status_history` VALUES (1,15,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(2,16,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(3,17,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(4,18,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(5,19,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(6,20,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(7,21,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(8,22,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(9,23,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(10,24,'pending','created','',NULL,1,'2026-02-12 11:54:48'),(11,25,'pending','created','',NULL,1,'2026-02-12 12:16:08'),(12,26,'pending','created','',NULL,1,'2026-02-12 12:16:48'),(13,27,'pending','created','',NULL,1,'2026-02-12 12:24:59'),(14,28,'pending','created','الانجاز\n ------------------------',NULL,1,'2026-02-12 13:08:11'),(15,29,'pending','created','الانجاز\n ------------------------',NULL,1,'2026-02-12 13:40:49'),(16,30,'pending','created','الانجاز\n ------------------------',NULL,1,'2026-02-12 13:41:30'),(17,31,'pending','created','الانجاز\n ------------------------',NULL,1,'2026-02-12 13:43:42'),(18,32,'pending','created','الانجاز\n ------------------------',NULL,1,'2026-02-12 13:46:05'),(19,30,'returned','status','',NULL,1,'2026-02-12 14:18:11'),(20,30,'returned','rep_clear','auto_clear_after_status',NULL,1,'2026-02-12 14:18:11'),(21,14,'returned','status','',NULL,1,'2026-02-12 16:40:50'),(22,14,'returned','rep_clear','auto_clear_after_status',NULL,1,'2026-02-12 16:40:50'),(23,16,'delivered','status','',NULL,1,'2026-02-12 16:40:59'),(24,16,'in_delivery','rep_clear','auto_clear_after_status',NULL,1,'2026-02-12 16:40:59'),(25,15,'delivered','status','',NULL,1,'2026-02-12 16:41:07'),(26,15,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-12 16:41:07'),(27,17,'delivered','status','',NULL,1,'2026-02-12 16:41:07'),(28,17,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-12 16:41:07'),(29,27,'delivered','status','',NULL,1,'2026-02-13 11:00:26'),(30,27,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:00:26'),(31,26,'delivered','status','',NULL,1,'2026-02-13 11:00:26'),(32,26,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:00:26'),(33,29,'delivered','status','',NULL,1,'2026-02-13 11:00:26'),(34,29,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:00:26'),(35,28,'delivered','status','',NULL,1,'2026-02-13 11:00:26'),(36,28,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:00:26'),(37,31,'delivered','status','',NULL,1,'2026-02-13 11:01:04'),(38,31,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:01:04'),(39,32,'delivered','status','',NULL,1,'2026-02-13 11:01:04'),(40,32,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:01:04'),(41,18,'delivered','status','',NULL,1,'2026-02-13 11:16:01'),(42,18,'in_delivery','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:16:01'),(43,19,'delivered','status','',NULL,1,'2026-02-13 11:16:18'),(44,19,'in_delivery','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:16:18'),(45,20,'delivered','status','',NULL,1,'2026-02-13 11:16:32'),(46,20,'delivered','rep_clear','auto_clear_after_status',NULL,1,'2026-02-13 11:16:32');
/*!40000 ALTER TABLE `order_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int(11) NOT NULL,
  `rep_id` int(11) DEFAULT NULL,
  `status` enum('pending','with_rep','delivered','returned','partial','postponed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `total_amount` decimal(15,2) NOT NULL,
  `shipping_fees` decimal(10,2) DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sales_office_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `customer_id` (`customer_id`),
  KEY `rep_id` (`rep_id`),
  KEY `idx_orders_sales_office_id` (`sales_office_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (4,'1',6,NULL,'delivered',820.00,70.00,'','2026-02-02 17:56:44',NULL),(6,'2',6,NULL,'delivered',820.00,70.00,'','2026-02-02 18:15:53',NULL),(7,'3',6,NULL,'delivered',820.00,70.00,'','2026-02-02 19:01:16',NULL),(8,'4',6,NULL,'delivered',820.00,70.00,'','2026-02-02 19:17:25',NULL),(9,'5',6,NULL,'delivered',820.00,70.00,'','2026-02-02 19:23:10',NULL),(10,'6',2,NULL,'delivered',550.00,0.00,'مفيش ملاحظات','2026-02-02 19:40:11',NULL),(11,'7',6,NULL,'delivered',820.00,70.00,'','2026-02-02 19:41:49',NULL),(12,'8',2,NULL,'pending',1500.00,0.00,'','2026-02-03 22:13:48',NULL),(13,'9',6,NULL,'returned',820.00,70.00,'','2026-02-05 15:30:57',NULL),(14,'10',2,NULL,'returned',350.00,0.00,'','2026-02-05 15:31:59',NULL),(15,'11',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(16,'12',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(17,'13',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(18,'14',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(19,'15',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(20,'16',6,NULL,'delivered',820.00,70.00,'','2026-02-12 11:54:48',NULL),(21,'17',6,NULL,'pending',820.00,70.00,'','2026-02-12 11:54:48',NULL),(22,'18',6,NULL,'pending',820.00,70.00,'','2026-02-12 11:54:48',NULL),(23,'19',6,NULL,'pending',820.00,70.00,'','2026-02-12 11:54:48',NULL),(24,'20',6,NULL,'pending',820.00,70.00,'','2026-02-12 11:54:48',NULL),(25,'21',6,NULL,'pending',820.00,70.00,'','2026-02-12 12:16:08',NULL),(26,'22',6,NULL,'delivered',820.00,70.00,'','2026-02-12 12:16:48',NULL),(27,'23',6,NULL,'delivered',820.00,70.00,'','2026-02-12 12:24:59',NULL),(28,'24',6,NULL,'delivered',920.00,70.00,'الانجاز\n ------------------------','2026-02-12 13:08:11',NULL),(29,'25',6,NULL,'delivered',920.00,70.00,'الانجاز\n ------------------------','2026-02-12 13:40:49',NULL),(30,'26',6,NULL,'returned',920.00,70.00,'الانجاز\n ------------------------','2026-02-12 13:41:30',NULL),(31,'27',6,NULL,'delivered',920.00,70.00,'الانجاز\n ------------------------','2026-02-12 13:43:42',NULL),(32,'28',6,NULL,'delivered',920.00,70.00,'الانجاز\n ------------------------','2026-02-12 13:46:05',NULL);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_actions`
--

DROP TABLE IF EXISTS `permission_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permission_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_actions`
--

LOCK TABLES `permission_actions` WRITE;
/*!40000 ALTER TABLE `permission_actions` DISABLE KEYS */;
INSERT INTO `permission_actions` VALUES (2,'عرض (view)','view'),(3,'اضافة (add)','add'),(4,'تعديل (edit)','edit'),(5,'حذف (delete)','delete'),(6,'طباعة','print'),(7,'تصدير','export');
/*!40000 ALTER TABLE `permission_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_modules`
--

DROP TABLE IF EXISTS `permission_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permission_modules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `order` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_permission_modules_name` (`name`),
  KEY `parent_id` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_modules`
--

LOCK TABLES `permission_modules` WRITE;
/*!40000 ALTER TABLE `permission_modules` DISABLE KEYS */;
INSERT INTO `permission_modules` VALUES (3,'users',NULL,0),(4,'customers',NULL,0),(5,'suppliers',NULL,0),(6,'treasuries',NULL,0),(7,'warehouses',NULL,0),(8,'products',NULL,0),(9,'orders',NULL,0),(10,'transactions',NULL,0),(11,'sales',NULL,0),(12,'employees',NULL,0),(13,'stock',NULL,0),(14,'product_movements',NULL,0),(15,'reports',NULL,0),(16,'finance',NULL,0),(17,'inventory',NULL,0),(18,'settings',NULL,0),(67,'fabrics',NULL,0),(68,'accessories',NULL,0),(69,'production_stages',NULL,0),(70,'colors',NULL,0),(71,'sizes',NULL,0),(72,'factory_products',NULL,0),(73,'cutting_stage',NULL,0),(74,'sales_offices',NULL,0),(75,'permissions',NULL,0);
/*!40000 ALTER TABLE `permission_modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_movements`
--

DROP TABLE IF EXISTS `product_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` enum('purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `product_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_movements_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=168 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_movements`
--

LOCK TABLES `product_movements` WRITE;
/*!40000 ALTER TABLE `product_movements` DISABLE KEYS */;
INSERT INTO `product_movements` VALUES (1,2,2,'purchase',3,0,3,1,'purchase_invoice','{\"name\":\"AutoTest Product\",\"color\":\"Blue\",\"sellingPrice\":18,\"qty\":3,\"isNew\":true,\"costPrice\":12.5,\"size\":\"L\"}',NULL,'2026-02-02 02:20:39'),(2,1,2,'purchase',100,55,155,3,'purchase_invoice','{\"id\":1769998942005,\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":\"100.00\",\"sellingPrice\":\"200.00\",\"qty\":100,\"barcode\":\"883880888276\",\"productId\":\"1\"}',NULL,'2026-02-02 02:22:32'),(3,1,2,'purchase',400,155,555,4,'purchase_invoice','{\"id\":1769999389217,\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":\"100.00\",\"sellingPrice\":\"200.00\",\"qty\":400,\"barcode\":\"883880888276\",\"productId\":\"1\"}',NULL,'2026-02-02 02:29:59'),(4,1,2,'return_out',-500,555,55,5,'return_invoice','{\"id\":1770000147716,\"productId\":\"1\",\"qty\":500,\"costPrice\":\"100.00\",\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1 (\\u0627\\u0633\\u0648\\u062f-5)\"}',NULL,'2026-02-02 02:42:40'),(5,1,2,'transfer_out',-5,55,50,6,'transfer','{\"productId\":\"1\",\"qty\":5}',NULL,'2026-02-02 15:56:07'),(6,1,3,'transfer_in',5,0,5,6,'transfer','{\"productId\":\"1\",\"qty\":5}',NULL,'2026-02-02 15:56:07'),(7,1,2,'transfer_out',-90,50,0,7,'transfer','{\"productId\":\"1\",\"qty\":90}',NULL,'2026-02-02 16:01:09'),(8,1,3,'transfer_in',90,5,95,7,'transfer','{\"productId\":\"1\",\"qty\":90}',NULL,'2026-02-02 16:01:09'),(9,1,3,'transfer_out',-10,95,85,8,'transfer','{\"productId\":\"1\",\"qty\":10}',NULL,'2026-02-02 16:09:29'),(10,1,2,'transfer_in',10,0,10,8,'transfer','{\"productId\":\"1\",\"qty\":10}',NULL,'2026-02-02 16:09:29'),(36,4,2,'transfer_out',-1,50,49,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-02 23:39:15'),(37,4,2,'transfer_out',-1,49,48,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-02 23:39:15'),(38,6,2,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-02 23:39:15'),(39,4,2,'transfer_out',-1,48,47,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-02 23:39:15'),(40,4,2,'transfer_out',-1,47,46,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-02 23:39:15'),(41,6,2,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-02 23:39:15'),(42,4,2,'transfer_out',-1,46,45,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-02 23:39:15'),(43,4,2,'transfer_out',-1,45,44,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-02 23:39:15'),(44,6,2,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-02 23:39:15'),(45,4,2,'transfer_out',-1,44,43,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-02 23:39:15'),(46,4,2,'transfer_out',-1,43,42,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-02 23:39:15'),(47,6,2,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-02 23:39:15'),(48,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:10:56'),(49,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:10:56'),(50,6,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:10:56'),(51,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:10:56'),(52,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:10:56'),(53,6,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:10:56'),(54,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:10:56'),(55,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:10:56'),(56,6,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:10:56'),(57,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:10:56'),(58,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:10:56'),(59,6,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:10:56'),(60,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:10:56'),(61,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:10:56'),(62,6,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:10:56'),(63,4,3,'transfer_out',-1,0,0,10,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:10:56'),(64,1,3,'transfer_out',-1,85,84,10,'order_hand_over','{\"product_id\":1,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:10:56'),(65,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:12:52'),(66,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:12:52'),(67,6,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:12:52'),(68,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:12:52'),(69,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:12:52'),(70,6,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:12:52'),(71,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:12:52'),(72,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:12:52'),(73,6,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:12:52'),(74,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:12:52'),(75,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:12:52'),(76,6,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:12:52'),(77,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:12:52'),(78,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:12:52'),(79,6,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:12:52'),(80,4,3,'transfer_out',-1,0,0,10,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:12:52'),(81,1,3,'transfer_out',-1,84,83,10,'order_hand_over','{\"product_id\":1,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:12:52'),(82,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:14:27'),(83,4,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:14:27'),(84,6,3,'transfer_out',-1,0,0,4,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":4}',NULL,'2026-02-03 00:14:27'),(85,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:14:27'),(86,4,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:14:27'),(87,6,3,'transfer_out',-1,0,0,6,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":6}',NULL,'2026-02-03 00:14:27'),(88,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:14:27'),(89,4,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:14:27'),(90,6,3,'transfer_out',-1,0,0,7,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":7}',NULL,'2026-02-03 00:14:27'),(91,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:14:27'),(92,4,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:14:27'),(93,6,3,'transfer_out',-1,0,0,8,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":8}',NULL,'2026-02-03 00:14:27'),(94,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:14:27'),(95,4,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:14:27'),(96,6,3,'transfer_out',-1,0,0,9,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":9}',NULL,'2026-02-03 00:14:27'),(97,4,3,'transfer_out',-1,0,0,10,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:14:27'),(98,1,3,'transfer_out',-1,83,82,10,'order_hand_over','{\"product_id\":1,\"quantity\":1,\"order_id\":10}',NULL,'2026-02-03 00:14:27'),(99,4,3,'purchase',1,0,1,11,'partial_return','{\"order_id\":11}',NULL,'2026-02-03 02:02:12'),(100,6,3,'purchase',1,0,1,11,'partial_return','{\"order_id\":11}',NULL,'2026-02-03 02:02:12'),(101,4,3,'purchase',1,1,2,10,'partial_return','{\"order_id\":10}',NULL,'2026-02-03 02:02:17'),(102,4,3,'purchase',1,2,3,7,'partial_return','{\"order_id\":7}',NULL,'2026-02-03 02:02:25'),(103,6,3,'purchase',1,1,2,7,'partial_return','{\"order_id\":7}',NULL,'2026-02-03 02:02:25'),(104,4,3,'purchase',100,3,103,62,'purchase_invoice','{\"id\":1770321908090,\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":\"170.00\",\"sellingPrice\":\"350.00\",\"qty\":100,\"barcode\":\"146201222292\",\"productId\":\"4\"}',NULL,'2026-02-05 20:05:30'),(105,4,3,'transfer_out',-1,103,102,13,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":13,\"reason\":\"\\u062a\\u0633\\u0644\\u064a\\u0645 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-06 12:31:29'),(106,4,3,'transfer_out',-1,102,101,13,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":13,\"reason\":\"\\u062a\\u0633\\u0644\\u064a\\u0645 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-06 12:31:29'),(107,6,3,'transfer_out',-1,2,1,13,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":13,\"reason\":\"\\u062a\\u0633\\u0644\\u064a\\u0645 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-06 12:31:29'),(108,4,3,'transfer_out',-1,101,100,14,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":14,\"reason\":\"\\u062a\\u0633\\u0644\\u064a\\u0645 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-06 12:31:29'),(109,6,3,'purchase',100,1,101,66,'purchase_invoice','{\"id\":1770435715366,\"isNew\":false,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":150,\"sellingPrice\":\"300.00\",\"qty\":100,\"barcode\":\"463533939174\",\"productId\":\"6\"}',NULL,'2026-02-07 03:44:39'),(110,7,2,'transfer_in',10,0,10,4,'dispatch_order','{\"dispatch_order_id\":4,\"dispatch_code\":\"DSP-20260208-00004\",\"factory_product_id\":2,\"size_id\":3,\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"qty_sent\":10,\"qty_received\":10}',1,'2026-02-08 04:43:49'),(111,8,2,'transfer_in',8,0,8,5,'dispatch_order','{\"dispatch_order_id\":5,\"dispatch_code\":\"DSP-20260208-00005\",\"factory_product_id\":4,\"size_id\":3,\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"qty_sent\":8,\"qty_received\":8}',1,'2026-02-08 05:15:30'),(112,9,3,'purchase',100,0,100,72,'purchase_invoice','{\"id\":1770531364768,\"isNew\":true,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u0645\\u062e\\u0632\\u0646 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0627\\u0632\\u0631\\u0642\",\"size\":\"10\",\"costPrice\":150,\"sellingPrice\":350,\"qty\":100,\"barcode\":\"907003188651\",\"productId\":\"\",\"itemType\":\"product_new\"}',1,'2026-02-08 06:16:36'),(113,2,3,'purchase',100,0,100,72,'purchase_invoice','{\"id\":1770531367467,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"AutoTest Product\",\"color\":\"Blue\",\"size\":\"L\",\"costPrice\":12.5,\"sellingPrice\":18,\"qty\":100,\"barcode\":\"949751527205\",\"productId\":\"2\"}',1,'2026-02-08 06:16:36'),(114,6,3,'transfer_out',-1,101,100,74,'warehouse_transfer','{\"to\":2,\"item\":{\"productId\":6,\"qty\":1,\"transferType\":\"product\",\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"barcode\":\"463533939174\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":0,\"sellingPrice\":300}}',1,'2026-02-08 06:17:12'),(115,6,2,'transfer_in',1,0,1,74,'warehouse_transfer','{\"from\":3,\"item\":{\"productId\":6,\"qty\":1,\"transferType\":\"product\",\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"barcode\":\"463533939174\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":0,\"sellingPrice\":300}}',1,'2026-02-08 06:17:12'),(116,1,3,'transfer_out',-2,82,80,74,'warehouse_transfer','{\"to\":2,\"item\":{\"productId\":1,\"qty\":2,\"transferType\":\"product\",\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"barcode\":\"883880888276\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":100,\"sellingPrice\":200}}',1,'2026-02-08 06:17:12'),(117,1,2,'transfer_in',2,10,12,74,'warehouse_transfer','{\"from\":3,\"item\":{\"productId\":1,\"qty\":2,\"transferType\":\"product\",\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"barcode\":\"883880888276\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":100,\"sellingPrice\":200}}',1,'2026-02-08 06:17:12'),(118,1,3,'return_out',-30,80,50,75,'supplier_return','{\"id\":1770537294214,\"productId\":\"1\",\"qty\":30,\"costPrice\":100,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1 (\\u0627\\u0633\\u0648\\u062f-5)\",\"returnType\":\"product\",\"total\":100}',1,'2026-02-08 07:55:03'),(119,4,3,'purchase',1,100,101,92,'purchase_invoice','{\"productId\":4,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"qty\":1,\"costPrice\":170,\"sellingPrice\":350}',1,'2026-02-12 11:31:09'),(120,6,3,'purchase',1,100,101,92,'purchase_invoice','{\"productId\":6,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"qty\":1,\"costPrice\":0,\"sellingPrice\":300}',1,'2026-02-12 11:31:09'),(121,8,3,'purchase',100,0,100,93,'purchase_invoice','{\"productId\":8,\"name\":\"\\u0628\\u062f\\u0644\\u0647\",\"qty\":100,\"costPrice\":50,\"sellingPrice\":750}',1,'2026-02-12 11:31:30'),(122,4,3,'purchase',1,101,102,94,'purchase_invoice','{\"id\":1770895903522,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":1,\"barcode\":\"146201222292\",\"productId\":\"4\"}',1,'2026-02-12 11:32:20'),(123,6,3,'purchase',1,101,102,95,'purchase_invoice','{\"id\":1770896063958,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":0,\"sellingPrice\":300,\"qty\":1,\"barcode\":\"463533939174\",\"productId\":\"6\"}',1,'2026-02-12 11:34:34'),(124,4,3,'purchase',100,102,202,96,'purchase_invoice','{\"id\":1770896520875,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":100,\"barcode\":\"146201222292\",\"productId\":\"4\"}',1,'2026-02-12 11:42:12'),(125,4,3,'return_out',-100,202,102,97,'supplier_return','{\"id\":1770896520875,\"productId\":\"4\",\"qty\":100,\"costPrice\":170,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628 (\\u0647\\u0627\\u0641\\u0627\\u0646-3\\u0633\\u0646\\u064a\\u0646)\",\"returnType\":\"product\",\"total\":170}',1,'2026-02-12 11:42:53'),(126,4,3,'purchase',10,102,112,98,'purchase_invoice','{\"id\":1770896533014,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":10,\"barcode\":\"146201222292\",\"productId\":\"4\"}',1,'2026-02-12 11:45:18'),(127,1,3,'purchase',10,50,60,99,'purchase_invoice','{\"id\":1770896719100,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":100,\"sellingPrice\":200,\"qty\":10,\"barcode\":\"883880888276\",\"productId\":\"1\"}',1,'2026-02-12 11:47:10'),(128,4,3,'sale',-1,112,111,100,'sale_invoice','{\"product_id\":4,\"qty\":1,\"price\":250,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\"}',NULL,'2026-02-12 13:43:42'),(129,4,3,'sale',-1,111,110,100,'sale_invoice','{\"product_id\":4,\"qty\":1,\"price\":250,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\"}',NULL,'2026-02-12 13:43:42'),(130,6,3,'sale',-1,102,101,100,'sale_invoice','{\"product_id\":6,\"qty\":1,\"price\":350,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\"}',NULL,'2026-02-12 13:43:42'),(131,4,3,'transfer_out',-1,110,109,30,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":30,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(132,4,3,'transfer_out',-1,109,108,30,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":30,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(133,6,3,'transfer_out',-1,101,100,30,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":30,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(134,4,3,'transfer_out',-1,108,107,31,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":31,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(135,4,3,'transfer_out',-1,107,106,31,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":31,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(136,6,3,'transfer_out',-1,100,99,31,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":31,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(137,4,3,'transfer_out',-1,106,105,32,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":32,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(138,4,3,'transfer_out',-1,105,104,32,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":32,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(139,6,3,'transfer_out',-1,99,98,32,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":32,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 14:03:16'),(140,4,3,'transfer_out',-1,104,103,14,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":14,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(141,4,3,'transfer_out',-1,103,102,15,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":15,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(142,4,3,'transfer_out',-1,102,101,15,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":15,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(143,6,3,'transfer_out',-1,98,97,15,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":15,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(144,4,3,'transfer_out',-1,101,100,16,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":16,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(145,4,3,'transfer_out',-1,100,99,16,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":16,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(146,6,3,'transfer_out',-1,97,96,16,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":16,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(147,4,3,'transfer_out',-1,99,98,17,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":17,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(148,4,3,'transfer_out',-1,98,97,17,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":17,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(149,6,3,'transfer_out',-1,96,95,17,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":17,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-12 16:40:25'),(150,4,3,'transfer_out',-1,97,96,26,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":26,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(151,4,3,'transfer_out',-2,96,94,27,'order_hand_over','{\"product_id\":4,\"quantity\":2,\"order_id\":27,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(152,6,3,'transfer_out',-1,95,94,27,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":27,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(153,4,3,'transfer_out',-1,94,93,28,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":28,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(154,4,3,'transfer_out',-1,93,92,28,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":28,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(155,6,3,'transfer_out',-1,94,93,28,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":28,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(156,4,3,'transfer_out',-1,92,91,29,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":29,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(157,4,3,'transfer_out',-1,91,90,29,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":29,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(158,6,3,'transfer_out',-1,93,92,29,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":29,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 10:59:49'),(159,4,3,'transfer_out',-1,90,89,18,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":18,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(160,4,3,'transfer_out',-1,89,88,18,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":18,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(161,6,3,'transfer_out',-1,92,91,18,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":18,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(162,4,3,'transfer_out',-1,88,87,19,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":19,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(163,4,3,'transfer_out',-1,87,86,19,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":19,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(164,6,3,'transfer_out',-1,91,90,19,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":19,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(165,4,3,'transfer_out',-1,86,85,20,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":20,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(166,4,3,'transfer_out',-1,85,84,20,'order_hand_over','{\"product_id\":4,\"quantity\":1,\"order_id\":20,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11'),(167,6,3,'transfer_out',-1,90,89,20,'order_hand_over','{\"product_id\":6,\"quantity\":1,\"order_id\":20,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}',NULL,'2026-02-13 11:15:11');
/*!40000 ALTER TABLE `product_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_tracking`
--

DROP TABLE IF EXISTS `product_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `manufacturing_order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `size_id` int(11) DEFAULT NULL,
  `piece_uid` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_paid` tinyint(1) DEFAULT NULL,
  `piece_rate` decimal(10,2) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `customer_id` int(11) DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `manufacturing_order_id` (`manufacturing_order_id`),
  KEY `product_id` (`product_id`),
  KEY `stage_id` (`stage_id`),
  KEY `worker_id` (`worker_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `product_tracking_ibfk_1` FOREIGN KEY (`manufacturing_order_id`) REFERENCES `manufacturing_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_tracking_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`),
  CONSTRAINT `product_tracking_ibfk_3` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`),
  CONSTRAINT `product_tracking_ibfk_4` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`),
  CONSTRAINT `product_tracking_ibfk_5` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_tracking`
--

LOCK TABLES `product_tracking` WRITE;
/*!40000 ALTER TABLE `product_tracking` DISABLE KEYS */;
INSERT INTO `product_tracking` VALUES (1,1,1,1,2,3,'a1668dcd1a355cdbfc0134a7a170a4cf',0,0.00,'2026-02-08 01:54:28','2026-02-08 02:56:53',NULL,NULL,NULL),(2,1,1,1,2,3,'860b9d8c4d67a5fe000dfa6c184f8f6f',0,0.00,'2026-02-08 01:54:28','2026-02-08 02:56:53',NULL,NULL,NULL),(3,1,1,1,2,3,'5d4107324a9725166e5c826a22eeb788',0,0.00,'2026-02-08 01:54:28','2026-02-08 02:56:53',NULL,NULL,NULL),(4,1,1,1,2,3,'76a2a579e57b238dfd34af804776b189',0,0.00,'2026-02-08 01:54:28','2026-02-08 02:56:53',NULL,NULL,NULL),(5,1,1,1,2,3,'684c8cab09e61c5e6d2be33d33e8341e',0,0.00,'2026-02-08 01:54:28','2026-02-08 02:56:53',NULL,NULL,NULL),(6,1,1,2,2,3,'a1668dcd1a355cdbfc0134a7a170a4cf',0,0.00,'2026-02-08 01:56:53','2026-02-08 02:57:03',NULL,NULL,NULL),(7,1,1,2,2,3,'860b9d8c4d67a5fe000dfa6c184f8f6f',0,0.00,'2026-02-08 01:56:53','2026-02-08 02:57:03',NULL,NULL,NULL),(8,1,1,2,2,3,'5d4107324a9725166e5c826a22eeb788',0,0.00,'2026-02-08 01:56:53','2026-02-08 02:57:03',NULL,NULL,NULL),(9,1,1,2,2,3,'76a2a579e57b238dfd34af804776b189',0,0.00,'2026-02-08 01:56:53','2026-02-08 02:57:41',NULL,NULL,NULL),(10,1,1,2,2,3,'684c8cab09e61c5e6d2be33d33e8341e',0,0.00,'2026-02-08 01:56:53','2026-02-08 02:57:41',NULL,NULL,NULL),(11,1,1,3,2,3,'a1668dcd1a355cdbfc0134a7a170a4cf',0,0.00,'2026-02-08 01:57:03','2026-02-08 02:58:02',NULL,NULL,NULL),(12,1,1,3,2,3,'860b9d8c4d67a5fe000dfa6c184f8f6f',0,0.00,'2026-02-08 01:57:03','2026-02-08 02:58:02',NULL,NULL,NULL),(13,1,1,3,2,3,'5d4107324a9725166e5c826a22eeb788',0,0.00,'2026-02-08 01:57:03','2026-02-08 02:58:02',NULL,NULL,NULL),(14,1,1,3,2,3,'76a2a579e57b238dfd34af804776b189',0,0.00,'2026-02-08 01:57:41','2026-02-08 02:58:02',NULL,NULL,NULL),(15,1,1,3,2,3,'684c8cab09e61c5e6d2be33d33e8341e',0,0.00,'2026-02-08 01:57:41','2026-02-08 02:58:02',NULL,NULL,NULL),(16,1,1,1,2,3,'2abfcaf391e4a4c4621f33b33a3abc48',1,10.00,'2026-02-08 01:59:16','2026-02-08 03:05:50',NULL,NULL,NULL),(17,1,1,1,2,3,'b5ec44fe24a083ed2295c8b3cf3673e6',1,10.00,'2026-02-08 01:59:16','2026-02-08 03:05:50',NULL,NULL,NULL),(18,1,1,1,2,3,'2e09dd9954eb5557de980fb068aeab66',1,10.00,'2026-02-08 01:59:16','2026-02-08 03:05:50',NULL,NULL,NULL),(19,1,1,1,2,3,'83f3052139d3d6d130a8abbd141c4d3f',1,10.00,'2026-02-08 01:59:16','2026-02-08 03:05:50',NULL,NULL,NULL),(20,1,1,1,2,3,'d08dd1ddb8136926d60c765bde3e9b1f',1,10.00,'2026-02-08 01:59:16','2026-02-08 03:05:50',NULL,NULL,NULL),(21,2,2,1,2,3,'ec3cbb86eb68136ebf579bd34ccb1623',1,10.00,'2026-02-08 01:59:28','2026-02-08 03:06:04',NULL,NULL,NULL),(22,2,2,1,2,3,'33b0b108c40128c47844bbf522d5fa15',1,10.00,'2026-02-08 01:59:28','2026-02-08 03:06:04',NULL,NULL,NULL),(23,2,2,1,2,3,'788a169bc587cc6a0e8a16d69570481a',1,10.00,'2026-02-08 01:59:28','2026-02-08 03:06:04',NULL,NULL,NULL),(24,2,2,1,2,3,'dd10985ab5aaf989bff046ce98ccd4ad',1,10.00,'2026-02-08 01:59:28','2026-02-08 03:06:04',NULL,NULL,NULL),(25,2,2,1,2,3,'95ad75226f1809e8429607de568da2ef',1,10.00,'2026-02-08 01:59:28','2026-02-08 03:06:04',NULL,NULL,NULL),(26,1,1,2,2,3,'2abfcaf391e4a4c4621f33b33a3abc48',1,10.00,'2026-02-08 02:05:50','2026-02-08 05:30:30',NULL,NULL,NULL),(27,1,1,2,2,3,'b5ec44fe24a083ed2295c8b3cf3673e6',1,10.00,'2026-02-08 02:05:50','2026-02-08 05:30:30',NULL,NULL,NULL),(28,1,1,2,2,3,'2e09dd9954eb5557de980fb068aeab66',1,10.00,'2026-02-08 02:05:50','2026-02-08 05:30:30',NULL,NULL,NULL),(29,1,1,2,2,3,'83f3052139d3d6d130a8abbd141c4d3f',1,10.00,'2026-02-08 02:05:50','2026-02-08 05:30:30',NULL,NULL,NULL),(30,1,1,2,2,3,'d08dd1ddb8136926d60c765bde3e9b1f',1,10.00,'2026-02-08 02:05:50','2026-02-08 05:30:30',NULL,NULL,NULL),(31,2,2,2,2,3,'ec3cbb86eb68136ebf579bd34ccb1623',1,10.00,'2026-02-08 02:06:04','2026-02-08 05:30:47',NULL,NULL,NULL),(32,2,2,2,2,3,'33b0b108c40128c47844bbf522d5fa15',1,10.00,'2026-02-08 02:06:04','2026-02-08 05:30:47',NULL,NULL,NULL),(33,2,2,2,2,3,'788a169bc587cc6a0e8a16d69570481a',1,10.00,'2026-02-08 02:06:04','2026-02-08 05:30:47',NULL,NULL,NULL),(34,2,2,2,2,3,'dd10985ab5aaf989bff046ce98ccd4ad',1,10.00,'2026-02-08 02:06:04','2026-02-08 05:30:47',NULL,NULL,NULL),(35,2,2,2,2,3,'95ad75226f1809e8429607de568da2ef',1,10.00,'2026-02-08 02:06:04','2026-02-08 05:30:47',NULL,NULL,NULL),(36,1,1,3,2,3,'2abfcaf391e4a4c4621f33b33a3abc48',0,0.00,'2026-02-08 04:30:30','2026-02-08 05:30:37',NULL,NULL,NULL),(37,1,1,3,2,3,'b5ec44fe24a083ed2295c8b3cf3673e6',0,0.00,'2026-02-08 04:30:30','2026-02-08 05:30:37',NULL,NULL,NULL),(38,1,1,3,2,3,'2e09dd9954eb5557de980fb068aeab66',0,0.00,'2026-02-08 04:30:30','2026-02-08 05:30:37',NULL,NULL,NULL),(39,1,1,3,2,3,'83f3052139d3d6d130a8abbd141c4d3f',0,0.00,'2026-02-08 04:30:30','2026-02-08 05:30:37',NULL,NULL,NULL),(40,1,1,3,2,3,'d08dd1ddb8136926d60c765bde3e9b1f',0,0.00,'2026-02-08 04:30:30','2026-02-08 05:30:37',NULL,NULL,NULL),(41,2,2,3,2,3,'ec3cbb86eb68136ebf579bd34ccb1623',0,0.00,'2026-02-08 04:30:47','2026-02-08 05:30:51',NULL,NULL,NULL),(42,2,2,3,2,3,'33b0b108c40128c47844bbf522d5fa15',0,0.00,'2026-02-08 04:30:47','2026-02-08 05:31:03',NULL,NULL,NULL),(43,2,2,3,2,3,'788a169bc587cc6a0e8a16d69570481a',0,0.00,'2026-02-08 04:30:47','2026-02-08 05:31:03',NULL,NULL,NULL),(44,2,2,3,2,3,'dd10985ab5aaf989bff046ce98ccd4ad',0,0.00,'2026-02-08 04:30:47','2026-02-08 05:31:03',NULL,NULL,NULL),(45,2,2,3,2,3,'95ad75226f1809e8429607de568da2ef',0,0.00,'2026-02-08 04:30:47','2026-02-08 05:31:03',NULL,NULL,NULL),(46,3,1,1,2,3,'21a6259aaf86a51231ba7f6cded75433',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(47,3,1,1,2,3,'1fbfcac5de82e5cbc61e4cbed8c8fe63',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(48,3,1,1,2,3,'d25eff600b23102f3958559ab4482af7',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(49,3,1,1,2,3,'7150d7ce198c63b4dfc8d8bd101d7184',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(50,3,1,1,2,3,'476e5b531f6dcf7ef8ee04be46a6e57c',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(51,3,1,1,2,3,'455458e56b1209b2438ed00d923e99a2',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(52,3,1,1,2,3,'f3a825bb8b5f6cec1883a401bdccf3d9',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(53,3,1,1,2,3,'a4c443433d287b7adbaa41670a4c4b34',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(54,3,1,1,2,3,'5e3611bb0ca890ef94389275e9c80e03',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(55,3,1,1,2,3,'3c837c2e7af4b641de724bec827b0e73',0,0.00,'2026-02-08 04:57:07','2026-02-08 05:57:18',NULL,NULL,NULL),(56,3,1,2,2,3,'21a6259aaf86a51231ba7f6cded75433',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(57,3,1,2,2,3,'1fbfcac5de82e5cbc61e4cbed8c8fe63',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(58,3,1,2,2,3,'d25eff600b23102f3958559ab4482af7',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(59,3,1,2,2,3,'7150d7ce198c63b4dfc8d8bd101d7184',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(60,3,1,2,2,3,'476e5b531f6dcf7ef8ee04be46a6e57c',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(61,3,1,2,2,3,'455458e56b1209b2438ed00d923e99a2',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(62,3,1,2,2,3,'f3a825bb8b5f6cec1883a401bdccf3d9',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(63,3,1,2,2,3,'a4c443433d287b7adbaa41670a4c4b34',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(64,3,1,2,2,3,'5e3611bb0ca890ef94389275e9c80e03',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(65,3,1,2,2,3,'3c837c2e7af4b641de724bec827b0e73',0,0.00,'2026-02-08 04:57:18','2026-02-08 05:57:27',NULL,NULL,NULL),(66,3,1,3,2,3,'21a6259aaf86a51231ba7f6cded75433',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(67,3,1,3,2,3,'1fbfcac5de82e5cbc61e4cbed8c8fe63',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(68,3,1,3,2,3,'d25eff600b23102f3958559ab4482af7',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(69,3,1,3,2,3,'7150d7ce198c63b4dfc8d8bd101d7184',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(70,3,1,3,2,3,'476e5b531f6dcf7ef8ee04be46a6e57c',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(71,3,1,3,2,3,'455458e56b1209b2438ed00d923e99a2',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(72,3,1,3,2,3,'f3a825bb8b5f6cec1883a401bdccf3d9',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(73,3,1,3,2,3,'a4c443433d287b7adbaa41670a4c4b34',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(74,3,1,3,2,3,'5e3611bb0ca890ef94389275e9c80e03',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(75,3,1,3,2,3,'3c837c2e7af4b641de724bec827b0e73',0,0.00,'2026-02-08 04:57:27','2026-02-08 05:57:35',NULL,NULL,NULL),(76,4,1,1,2,3,'b84dc2be380453a737f2bfa9c22138a3',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(77,4,1,1,2,3,'dd235d7a7d12e072e12ece09d7e40de3',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(78,4,1,1,2,3,'3d9bd1700a386e442fa07ae88d2edc12',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(79,4,1,1,2,3,'03e4182ecec7522953f4cb89b759b00a',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(80,4,1,1,2,3,'f517bd4bbb56111aeea7ce53a700630b',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(81,4,1,1,2,3,'4815d3b50df298868a88ff8dbbb9108d',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(82,4,1,1,2,3,'a0c32c6681922c3ef888936c353809fa',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(83,4,1,1,2,3,'a78b2cafcd3d0312316b887312180907',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(84,4,1,1,2,3,'84d43589551bfd1c1aa2bbe92ac90f2c',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(85,4,1,1,2,3,'91bc45d0d7a5693d8ad146ed6886c420',0,0.00,'2026-02-08 05:56:17','2026-02-08 06:56:26',NULL,NULL,NULL),(86,4,1,2,2,3,'b84dc2be380453a737f2bfa9c22138a3',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(87,4,1,2,2,3,'dd235d7a7d12e072e12ece09d7e40de3',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(88,4,1,2,2,3,'3d9bd1700a386e442fa07ae88d2edc12',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(89,4,1,2,2,3,'03e4182ecec7522953f4cb89b759b00a',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(90,4,1,2,2,3,'f517bd4bbb56111aeea7ce53a700630b',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(91,4,1,2,2,3,'4815d3b50df298868a88ff8dbbb9108d',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(92,4,1,2,2,3,'a0c32c6681922c3ef888936c353809fa',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(93,4,1,2,2,3,'a78b2cafcd3d0312316b887312180907',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(94,4,1,2,2,3,'84d43589551bfd1c1aa2bbe92ac90f2c',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(95,4,1,2,2,3,'91bc45d0d7a5693d8ad146ed6886c420',0,0.00,'2026-02-08 05:56:26','2026-02-08 06:56:33',NULL,NULL,NULL),(96,4,1,3,2,3,'b84dc2be380453a737f2bfa9c22138a3',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(97,4,1,3,2,3,'dd235d7a7d12e072e12ece09d7e40de3',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(98,4,1,3,2,3,'3d9bd1700a386e442fa07ae88d2edc12',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(99,4,1,3,2,3,'03e4182ecec7522953f4cb89b759b00a',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(100,4,1,3,2,3,'f517bd4bbb56111aeea7ce53a700630b',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(101,4,1,3,2,3,'4815d3b50df298868a88ff8dbbb9108d',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(102,4,1,3,2,3,'a0c32c6681922c3ef888936c353809fa',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(103,4,1,3,2,3,'a78b2cafcd3d0312316b887312180907',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(104,4,1,3,2,3,'84d43589551bfd1c1aa2bbe92ac90f2c',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL),(105,4,1,3,2,3,'91bc45d0d7a5693d8ad146ed6886c420',0,0.00,'2026-02-08 05:56:33','2026-02-08 06:56:38',NULL,NULL,NULL);
/*!40000 ALTER TABLE `product_tracking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_stages`
--

DROP TABLE IF EXISTS `production_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `production_stages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_num` int(11) DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_stages`
--

LOCK TABLES `production_stages` WRITE;
/*!40000 ALTER TABLE `production_stages` DISABLE KEYS */;
INSERT INTO `production_stages` VALUES (1,'سنجر',1,'سنجر','2026-02-07 06:02:27'),(2,'اوفر',2,'اوفر','2026-02-07 06:02:37'),(3,'تقفيل',3,'تقفيل','2026-02-07 06:02:45');
/*!40000 ALTER TABLE `production_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `sale_price` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) DEFAULT '5',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'منتج جديد 1','اسود','5',100.00,'883880888276',NULL,200.00,5,NULL,NULL),(2,'AutoTest Product','Blue','L',12.50,'949751527205',NULL,18.00,5,NULL,NULL),(4,'دبدوب','هافان','3سنين',170.00,'146201222292',NULL,350.00,5,NULL,NULL),(6,'جاكيت','اسود','55',0.00,'463533939174',NULL,300.00,5,NULL,NULL),(7,'قميص','اسود','صغير',0.00,'FPV-2-3-c88682',NULL,150.00,5,'تصنيع',NULL),(8,'بدله','اسود','صغير',50.00,'FPV-4-3-c88682',NULL,750.00,5,'تصنيع',NULL),(9,'منتج مخزن رقم 2','ازرق','10',150.00,'907003188651',NULL,350.00,5,'product',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rep_cash_custody`
--

DROP TABLE IF EXISTS `rep_cash_custody`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rep_cash_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `treasury_id` int(11) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled` tinyint(1) DEFAULT '0',
  `settled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rep_id` (`rep_id`),
  KEY `treasury_id` (`treasury_id`),
  CONSTRAINT `rep_cash_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_cash_custody_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rep_cash_custody`
--

LOCK TABLES `rep_cash_custody` WRITE;
/*!40000 ALTER TABLE `rep_cash_custody` DISABLE KEYS */;
/*!40000 ALTER TABLE `rep_cash_custody` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rep_stock_custody`
--

DROP TABLE IF EXISTS `rep_stock_custody`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rep_stock_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rep_id` (`rep_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `rep_stock_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_stock_custody_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rep_stock_custody`
--

LOCK TABLES `rep_stock_custody` WRITE;
/*!40000 ALTER TABLE `rep_stock_custody` DISABLE KEYS */;
/*!40000 ALTER TABLE `rep_stock_custody` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_archives`
--

DROP TABLE IF EXISTS `report_archives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_archives` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `report_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sections` text COLLATE utf8mb4_unicode_ci,
  `html` longtext COLLATE utf8mb4_unicode_ci,
  `sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `report_date` (`report_date`),
  KEY `report_type` (`report_type`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_archives`
--

LOCK TABLES `report_archives` WRITE;
/*!40000 ALTER TABLE `report_archives` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_archives` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_email_otps`
--

DROP TABLE IF EXISTS `report_email_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_email_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_email_otps`
--

LOCK TABLES `report_email_otps` WRITE;
/*!40000 ALTER TABLE `report_email_otps` DISABLE KEYS */;
INSERT INTO `report_email_otps` VALUES (1,1,'mamdouh.hisham89@gmail.com','110598','2026-02-06 19:14:36','2026-02-06 20:24:36','2026-02-06 21:14:48');
/*!40000 ALTER TABLE `report_email_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_offices`
--

DROP TABLE IF EXISTS `sales_offices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sales_offices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_offices`
--

LOCK TABLES `sales_offices` WRITE;
/*!40000 ALTER TABLE `sales_offices` DISABLE KEYS */;
INSERT INTO `sales_offices` VALUES (2,'مكتب رقم 2','01150006289','2026-02-08 08:25:26'),(3,'مكتب رقم 1','01050016289','2026-02-08 08:32:42');
/*!40000 ALTER TABLE `sales_offices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('activation_account_status','Active'),('activation_expiry','2026-02-15'),('activation_hwid','e01f396012ff1137ecbf6f7b51830e1477e0f7b7fd1dfd3811248587cdfb07fa'),('activation_is_expired','false'),('activation_last_check','2026-02-13 20:05:40'),('activation_type','Trial'),('auto_backup','true'),('backup_email','mamdouh.hisham89@gmail.com'),('backup_email_verified','true'),('backup_frequency','hourly'),('company_address','العنوان كامل و مفصل لو اى حد عايز '),('company_logo','data:image/jpeg;base64,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'),('company_name','شركه تجريبيه '),('company_phone','011188898844'),('company_terms','سياسه الاسترجاع و المشاهده و كل شىء'),('currency','EGP'),('delivery_method','reps'),('product_source','both'),('report_auto','true'),('report_daily_audit','true'),('report_daily_sales','true'),('report_daily_treasury','true'),('report_email','mamdouh.hisham89@gmail.com'),('report_email_verified','true'),('sale_price_source','order'),('sales_calc_order','discount_then_tax'),('sales_display_method','company'),('tax_rate','0');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipping_companies`
--

DROP TABLE IF EXISTS `shipping_companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shipping_companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipping_companies`
--

LOCK TABLES `shipping_companies` WRITE;
/*!40000 ALTER TABLE `shipping_companies` DISABLE KEYS */;
INSERT INTO `shipping_companies` VALUES (1,'شركه رقم 1','015151515181','2026-02-09 22:03:50');
/*!40000 ALTER TABLE `shipping_companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sizes`
--

DROP TABLE IF EXISTS `sizes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sizes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sizes`
--

LOCK TABLES `sizes` WRITE;
/*!40000 ALTER TABLE `sizes` DISABLE KEYS */;
INSERT INTO `sizes` VALUES (1,'كبير','L','2026-02-07 06:04:14'),(2,'وسط','M','2026-02-07 06:04:22'),(3,'صغير','S','2026-02-07 06:04:31');
/*!40000 ALTER TABLE `sizes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock`
--

DROP TABLE IF EXISTS `stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock` (
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`product_id`,`warehouse_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock`
--

LOCK TABLES `stock` WRITE;
/*!40000 ALTER TABLE `stock` DISABLE KEYS */;
INSERT INTO `stock` VALUES (1,2,12),(1,3,60),(2,2,3),(2,3,100),(4,2,42),(4,3,84),(6,2,1),(6,3,89),(7,2,10),(8,2,8),(8,3,100),(9,3,100);
/*!40000 ALTER TABLE `stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `total_debit` decimal(15,2) DEFAULT '0.00',
  `total_credit` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (4,'مورد رقم 1','5161561651','يبتسينب',71765.00,0.00);
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('sale','purchase','return_in','return_out','payment_in','payment_out') COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `related_to_type` enum('customer','supplier','employee','none') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_to_id` int(11) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `transaction_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `details` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `treasury_id` (`treasury_id`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,'purchase',2,NULL,'supplier',2,37.50,'2026-02-02 04:20:39','[{\"name\":\"AutoTest Product\",\"color\":\"Blue\",\"sellingPrice\":18,\"qty\":3,\"isNew\":true,\"costPrice\":12.5,\"size\":\"L\"}]'),(3,'purchase',2,NULL,'supplier',4,10000.00,'2026-02-02 04:22:32','[{\"id\":1769998942005,\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":\"100.00\",\"sellingPrice\":\"200.00\",\"qty\":100,\"barcode\":\"883880888276\",\"productId\":\"1\"}]'),(4,'purchase',2,NULL,'supplier',4,40000.00,'2026-02-02 04:29:59','[{\"id\":1769999389217,\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":\"100.00\",\"sellingPrice\":\"200.00\",\"qty\":400,\"barcode\":\"883880888276\",\"productId\":\"1\"}]'),(5,'return_out',2,NULL,'supplier',4,50000.00,'2026-02-02 04:42:40','[{\"id\":1770000147716,\"productId\":\"1\",\"qty\":500,\"costPrice\":\"100.00\",\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1 (\\u0627\\u0633\\u0648\\u062f-5)\"}]'),(6,'sale',2,NULL,'none',NULL,0.00,'2026-02-02 17:56:07','{\"from\":2,\"to\":3,\"items\":[{\"productId\":\"1\",\"qty\":5}]}'),(7,'sale',2,NULL,'none',NULL,0.00,'2026-02-02 18:01:09','{\"from\":2,\"to\":3,\"items\":[{\"productId\":\"1\",\"qty\":90}]}'),(8,'sale',3,NULL,'none',NULL,0.00,'2026-02-02 18:09:29','{\"from\":3,\"to\":2,\"items\":[{\"productId\":\"1\",\"qty\":10}]}'),(9,'sale',NULL,NULL,'employee',2,2330.00,'2026-02-03 01:35:25','{\"orders\":[11,10,9],\"rep_id\":2}'),(10,'sale',2,2,'employee',2,3560.00,'2026-02-03 01:39:15','{\"orders\":[8,7,6,4],\"rep_id\":2}'),(11,'sale',3,2,'employee',2,5000.00,'2026-02-03 02:10:56','{\"orders\":[10,9,8,7,6,4],\"rep_id\":2}'),(12,'sale',3,2,'employee',2,5000.00,'2026-02-03 02:12:52','{\"orders\":[10,9,8,7,6,4],\"rep_id\":2}'),(13,'sale',3,2,'employee',2,5000.00,'2026-02-03 02:14:27','{\"orders\":[10,9,8,7,6,4],\"rep_id\":2}'),(14,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 03:38:20','{\"order_id\":11,\"action\":\"delivered\"}'),(15,'sale',NULL,NULL,'employee',2,706.00,'2026-02-03 03:38:31','{\"order_id\":9,\"action\":\"returned\"}'),(16,'sale',NULL,NULL,'employee',2,-550.00,'2026-02-03 03:42:45','{\"order_id\":10,\"action\":\"delivered\"}'),(17,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 03:42:45','{\"order_id\":11,\"action\":\"delivered\"}'),(18,'sale',NULL,NULL,'employee',2,-550.00,'2026-02-03 03:48:28','{\"order_id\":10,\"action\":\"delivered\"}'),(19,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 03:48:28','{\"order_id\":11,\"action\":\"delivered\"}'),(20,'sale',NULL,NULL,'employee',2,706.00,'2026-02-03 03:48:36','{\"order_id\":9,\"action\":\"returned\"}'),(21,'sale',NULL,NULL,'employee',2,706.00,'2026-02-03 03:48:36','{\"order_id\":8,\"action\":\"returned\"}'),(22,'sale',NULL,NULL,'employee',2,-350.00,'2026-02-03 04:02:12','{\"order_id\":11,\"action\":\"partial_delivered\",\"delivered\":350}'),(23,'sale',NULL,NULL,'employee',2,356.00,'2026-02-03 04:02:12','{\"order_id\":11,\"action\":\"partial_returned\",\"returned\":356}'),(24,'sale',NULL,NULL,'employee',2,-200.00,'2026-02-03 04:02:17','{\"order_id\":10,\"action\":\"partial_delivered\",\"delivered\":200}'),(25,'sale',NULL,NULL,'employee',2,350.00,'2026-02-03 04:02:17','{\"order_id\":10,\"action\":\"partial_returned\",\"returned\":350}'),(26,'sale',NULL,NULL,'employee',2,-350.00,'2026-02-03 04:02:25','{\"order_id\":7,\"action\":\"partial_delivered\",\"delivered\":350}'),(27,'sale',NULL,NULL,'employee',2,356.00,'2026-02-03 04:02:25','{\"order_id\":7,\"action\":\"partial_returned\",\"returned\":356}'),(28,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:02:33','{\"order_id\":9,\"action\":\"delivered\"}'),(29,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:02:33','{\"order_id\":7,\"action\":\"delivered\"}'),(30,'sale',NULL,NULL,'employee',2,-550.00,'2026-02-03 04:02:33','{\"order_id\":10,\"action\":\"delivered\"}'),(31,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:02:33','{\"order_id\":8,\"action\":\"delivered\"}'),(32,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:02:33','{\"order_id\":11,\"action\":\"delivered\"}'),(33,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:05:44','{\"order_id\":11,\"action\":\"delivered\"}'),(34,'sale',NULL,NULL,'employee',2,-550.00,'2026-02-03 04:05:44','{\"order_id\":10,\"action\":\"delivered\"}'),(35,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:05:44','{\"order_id\":9,\"action\":\"delivered\"}'),(36,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:05:44','{\"order_id\":8,\"action\":\"delivered\"}'),(37,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-03 04:05:44','{\"order_id\":7,\"action\":\"delivered\"}'),(38,'payment_in',NULL,NULL,'customer',2,13000.00,'2026-02-03 04:34:15','{\"note\":\"\"}'),(39,'payment_in',NULL,NULL,'customer',2,50.00,'2026-02-03 04:34:34','{\"note\":\"\"}'),(40,'payment_in',NULL,NULL,'customer',2,1000.00,'2026-02-03 04:36:14','{\"note\":\"\"}'),(41,'payment_in',NULL,2,'customer',2,1000.00,'2026-02-03 04:36:27','{\"note\":\"\"}'),(42,'payment_in',NULL,2,'customer',2,1000.00,'2026-02-03 04:36:58','{\"note\":\"\\u0633\\u0634\\u064a\\u0634\\u0633\\u064a\\u0636\\u0635 \\u0636 \\u0636\\u0635  \\u0636\\u0635\"}'),(43,'payment_in',NULL,2,'customer',2,1000.00,'2026-02-03 04:40:44','{\"note\":\"\"}'),(44,'payment_in',NULL,1,'customer',2,1000.00,'2026-02-03 04:43:04','{\"note\":\"213123123\"}'),(45,'payment_in',NULL,2,'customer',2,3204.00,'2026-02-04 00:20:00','{\"note\":\"\"}'),(46,'payment_in',NULL,2,'employee',NULL,500.00,'2026-02-05 17:02:10','null'),(47,'payment_in',NULL,2,'employee',NULL,6500.00,'2026-02-05 17:02:23','null'),(48,'payment_in',NULL,1,'employee',NULL,6500.00,'2026-02-05 17:02:36','null'),(49,'payment_in',NULL,2,'employee',NULL,10000.00,'2026-02-05 17:04:55','null'),(50,'payment_in',NULL,2,'employee',NULL,10000.00,'2026-02-05 17:08:56','null'),(51,'payment_in',NULL,1,'employee',NULL,5000.00,'2026-02-05 17:09:08','null'),(52,'payment_in',NULL,2,'employee',NULL,-500.00,'2026-02-05 17:26:02','null'),(53,'payment_in',NULL,2,'employee',NULL,150.00,'2026-02-05 17:33:24','null'),(54,'payment_in',NULL,2,'employee',NULL,-150.00,'2026-02-05 17:33:42','null'),(55,'payment_in',NULL,2,'employee',NULL,100.00,'2026-02-05 17:41:14','{\"notes\":\"\\u0627\\u064a\\u062f\\u0627\\u0639\",\"subtype\":\"deposit\"}'),(56,'payment_out',NULL,2,'employee',NULL,-100.00,'2026-02-05 17:41:22','{\"notes\":\"\\u0645\\u0635\\u0631\\u0648\\u0641\",\"subtype\":\"expense\"}'),(57,'sale',NULL,NULL,'employee',1,-706.00,'2026-02-05 17:54:21','{\"order_id\":11,\"action\":\"delivered\"}'),(58,'sale',NULL,NULL,'employee',2,-550.00,'2026-02-05 17:54:30','{\"order_id\":10,\"action\":\"delivered\"}'),(59,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-05 17:54:30','{\"order_id\":9,\"action\":\"delivered\"}'),(60,'sale',NULL,NULL,'employee',2,-706.00,'2026-02-05 17:54:30','{\"order_id\":8,\"action\":\"delivered\"}'),(61,'payment_in',NULL,2,'customer',2,-242.00,'2026-02-05 21:41:07','{\"note\":\"\"}'),(62,'purchase',3,2,'supplier',4,17000.00,'2026-02-05 22:05:30','[{\"id\":1770321908090,\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":\"170.00\",\"sellingPrice\":\"350.00\",\"qty\":100,\"barcode\":\"146201222292\",\"productId\":\"4\"}]'),(63,'sale',3,2,'employee',2,1240.00,'2026-02-06 14:31:29','{\"orders\":[14,13],\"rep_id\":2,\"reason\":\"\\u062a\\u0633\\u0644\\u064a\\u0645 \\u064a\\u0648\\u0645\\u064a\\u0647\"}'),(64,'sale',NULL,NULL,'employee',2,350.00,'2026-02-06 15:14:03','{\"order_id\":14,\"action\":\"returned\"}'),(65,'sale',NULL,NULL,'employee',2,1000.00,'2026-02-06 15:14:03','{\"order_id\":13,\"action\":\"returned\"}'),(66,'purchase',3,2,'supplier',4,15000.00,'2026-02-07 05:44:39','[{\"id\":1770435715366,\"isNew\":false,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":150,\"sellingPrice\":\"300.00\",\"qty\":100,\"barcode\":\"463533939174\",\"productId\":\"6\"}]'),(67,'purchase',3,NULL,'supplier',4,15000.00,'2026-02-07 07:29:26','[{\"id\":1770442144196,\"itemType\":\"fabric_new\",\"isNew\":true,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u0631\\u0642\\u0645 1\",\"color\":\"\\u0627\\u0628\\u064a\\u0636\",\"size\":\"\",\"costPrice\":100,\"sellingPrice\":0,\"qty\":150,\"barcode\":\"\",\"productId\":\"\"}]'),(68,'purchase',3,NULL,'supplier',4,6000.00,'2026-02-07 08:10:57','[{\"id\":1770444638369,\"itemType\":\"fabric_new\",\"isNew\":true,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0627\\u0632\\u0631\\u0642\",\"size\":\"\",\"costPrice\":60,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"\",\"productId\":\"\"}]'),(69,'purchase',3,NULL,'supplier',4,1500.00,'2026-02-08 08:15:25','[{\"id\":1770531315053,\"itemType\":\"fabric_existing\",\"isNew\":false,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"\",\"costPrice\":150,\"sellingPrice\":0,\"qty\":10,\"barcode\":\"FAB-20260207074811-364\",\"productId\":\"1\"}]'),(70,'purchase',3,NULL,'supplier',4,1000.00,'2026-02-08 08:15:40','[{\"id\":1770531325311,\"isNew\":true,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0627\\u0628\\u064a\\u0636\",\"size\":\"\",\"costPrice\":10,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"273403218295\",\"productId\":\"\",\"itemType\":\"fabric_new\"}]'),(71,'purchase',3,NULL,'supplier',4,1000.00,'2026-02-08 08:16:04','[{\"id\":1770531341127,\"isNew\":true,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0641\\u0636\\u064a\",\"size\":\"\",\"costPrice\":5,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"335496787242\",\"productId\":\"\",\"itemType\":\"accessory_new\"},{\"id\":1770531358253,\"itemType\":\"accessory_existing\",\"isNew\":false,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1\",\"color\":\"\\u0630\\u0647\\u0628\\u064a\",\"size\":\"\",\"costPrice\":5,\"sellingPrice\":0,\"qty\":100,\"barcode\":\"ACC-20260207080201-823\",\"productId\":\"1\"}]'),(72,'purchase',3,2,'supplier',4,16250.00,'2026-02-08 08:16:36','[{\"id\":1770531364768,\"isNew\":true,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u0645\\u062e\\u0632\\u0646 \\u0631\\u0642\\u0645 2\",\"color\":\"\\u0627\\u0632\\u0631\\u0642\",\"size\":\"10\",\"costPrice\":150,\"sellingPrice\":350,\"qty\":100,\"barcode\":\"907003188651\",\"productId\":\"\",\"itemType\":\"product_new\"},{\"id\":1770531367467,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"AutoTest Product\",\"color\":\"Blue\",\"size\":\"L\",\"costPrice\":12.5,\"sellingPrice\":18,\"qty\":100,\"barcode\":\"949751527205\",\"productId\":\"2\"}]'),(73,'return_out',3,NULL,'supplier',4,4500.00,'2026-02-08 08:16:54','[{\"id\":1770531315053,\"productId\":\"1\",\"qty\":30,\"costPrice\":150,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f (\\u0627\\u0633\\u0648\\u062f--)\",\"returnType\":\"fabric\",\"total\":150}]'),(74,'purchase',3,NULL,'none',NULL,200.00,'2026-02-08 08:17:12','{\"from\":3,\"to\":2,\"items\":[{\"productId\":6,\"qty\":1,\"transferType\":\"product\",\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"barcode\":\"463533939174\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":0,\"sellingPrice\":300},{\"productId\":1,\"qty\":2,\"transferType\":\"product\",\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"barcode\":\"883880888276\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":100,\"sellingPrice\":200}]}'),(75,'return_out',3,NULL,'supplier',4,4525.00,'2026-02-08 09:55:03','[{\"id\":1770537280414,\"productId\":\"1\",\"qty\":10,\"costPrice\":150,\"name\":\"\\u0642\\u0645\\u0627\\u0634 \\u062c\\u062f\\u064a\\u062f (\\u0627\\u0633\\u0648\\u062f--)\",\"returnType\":\"fabric\",\"total\":150},{\"id\":1770537289417,\"productId\":\"1\",\"qty\":5,\"costPrice\":5,\"name\":\"\\u0627\\u0643\\u0633\\u0633\\u0648\\u0627\\u0631 \\u0631\\u0642\\u0645 1 (\\u0630\\u0647\\u0628\\u064a--)\",\"returnType\":\"accessory\",\"total\":5},{\"id\":1770537294214,\"productId\":\"1\",\"qty\":30,\"costPrice\":100,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1 (\\u0627\\u0633\\u0648\\u062f-5)\",\"returnType\":\"product\",\"total\":100}]'),(76,'payment_in',NULL,3,'none',NULL,5000.00,'2026-02-11 21:03:27','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 6)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":6}'),(77,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:12:55','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 7)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":7}'),(78,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:17:49','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 8)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":8}'),(79,'payment_out',NULL,3,'none',NULL,-1000.00,'2026-02-11 21:18:23','{\"notes\":\"\\u062a\\u0635\\u0641\\u064a\\u0629\\/\\u062a\\u0633\\u0648\\u064a\\u0629 \\u062a\\u0623\\u0645\\u064a\\u0646 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 8\",\"subtype\":\"rep_insurance_clear\",\"rep_id\":8}'),(80,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:19:13','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 9)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":9}'),(81,'payment_out',NULL,3,'none',NULL,-1000.00,'2026-02-11 21:19:42','{\"notes\":\"\\u062a\\u0635\\u0641\\u064a\\u0629\\/\\u062a\\u0633\\u0648\\u064a\\u0629 \\u062a\\u0623\\u0645\\u064a\\u0646 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 9\",\"subtype\":\"rep_insurance_clear\",\"rep_id\":9}'),(82,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:21:03','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 10)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":10}'),(83,'payment_out',NULL,3,'none',NULL,-1000.00,'2026-02-11 21:21:32','{\"notes\":\"\\u062a\\u0635\\u0641\\u064a\\u0629\\/\\u062a\\u0633\\u0648\\u064a\\u0629 \\u062a\\u0623\\u0645\\u064a\\u0646 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 10\",\"subtype\":\"rep_insurance_clear\",\"rep_id\":10}'),(84,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:23:02','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 11)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":11}'),(85,'payment_in',NULL,3,'none',NULL,3000.00,'2026-02-11 21:24:30','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 12)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":12}'),(86,'payment_out',NULL,3,'none',NULL,-1000.00,'2026-02-11 21:24:59','{\"notes\":\"\\u062a\\u0635\\u0641\\u064a\\u0629\\/\\u062a\\u0633\\u0648\\u064a\\u0629 \\u062a\\u0623\\u0645\\u064a\\u0646 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 11\",\"subtype\":\"rep_insurance_clear\",\"rep_id\":11}'),(87,'payment_out',NULL,3,'none',NULL,-3000.00,'2026-02-11 21:25:59','{\"notes\":\"\\u062a\\u0635\\u0641\\u064a\\u0629\\/\\u062a\\u0633\\u0648\\u064a\\u0629 \\u062a\\u0623\\u0645\\u064a\\u0646 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 12\",\"subtype\":\"rep_insurance_clear\",\"rep_id\":12}'),(88,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:34:00','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 13)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":13}'),(89,'payment_in',NULL,3,'none',NULL,1000.00,'2026-02-11 21:34:00','{\"notes\":\"\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0645\\u0646\\u062f\\u0648\\u0628 \\u062c\\u062f\\u064a\\u062f (\\u0645\\u0646\\u062f\\u0648\\u0628 \\u0631\\u0642\\u0645 14)\",\"subtype\":\"rep_insurance_deposit\",\"rep_id\":14}'),(90,'payment_in',NULL,3,'customer',14,-1000.00,'2026-02-11 21:34:19','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":1000}'),(91,'payment_in',NULL,NULL,'customer',14,1000.00,'2026-02-11 21:34:19','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\u0627\\u0644\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0636\\u0645\\u0646 \\u062a\\u0635\\u0641\\u064a\\u0629 \\u0627\\u0644\\u062d\\u0633\\u0627\\u0628\",\"subtype\":\"rep_insurance_apply\"}'),(92,'purchase',3,2,'supplier',4,170.00,'2026-02-12 13:31:09','[{\"productId\":4,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"qty\":1,\"costPrice\":170,\"sellingPrice\":350},{\"productId\":6,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"qty\":1,\"costPrice\":0,\"sellingPrice\":300}]'),(93,'purchase',3,2,'supplier',4,5000.00,'2026-02-12 13:31:30','[{\"productId\":8,\"name\":\"\\u0628\\u062f\\u0644\\u0647\",\"qty\":100,\"costPrice\":50,\"sellingPrice\":750}]'),(94,'purchase',3,NULL,'supplier',4,170.00,'2026-02-12 13:32:20','[{\"id\":1770895903522,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":1,\"barcode\":\"146201222292\",\"productId\":\"4\"}]'),(95,'purchase',3,NULL,'supplier',4,0.00,'2026-02-12 13:34:34','[{\"id\":1770896063958,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"55\",\"costPrice\":0,\"sellingPrice\":300,\"qty\":1,\"barcode\":\"463533939174\",\"productId\":\"6\"}]'),(96,'purchase',3,NULL,'supplier',4,17000.00,'2026-02-12 13:42:12','[{\"id\":1770896520875,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":100,\"barcode\":\"146201222292\",\"productId\":\"4\"}]'),(97,'return_out',3,NULL,'supplier',4,17000.00,'2026-02-12 13:42:53','[{\"id\":1770896520875,\"productId\":\"4\",\"qty\":100,\"costPrice\":170,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628 (\\u0647\\u0627\\u0641\\u0627\\u0646-3\\u0633\\u0646\\u064a\\u0646)\",\"returnType\":\"product\",\"total\":170}]'),(98,'purchase',3,3,'supplier',4,1700.00,'2026-02-12 13:45:18','[{\"id\":1770896533014,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\",\"color\":\"\\u0647\\u0627\\u0641\\u0627\\u0646\",\"size\":\"3\\u0633\\u0646\\u064a\\u0646\",\"costPrice\":170,\"sellingPrice\":350,\"qty\":10,\"barcode\":\"146201222292\",\"productId\":\"4\"}]'),(99,'purchase',3,NULL,'supplier',4,1000.00,'2026-02-12 13:47:10','[{\"id\":1770896719100,\"itemType\":\"product_existing\",\"isNew\":false,\"name\":\"\\u0645\\u0646\\u062a\\u062c \\u062c\\u062f\\u064a\\u062f 1\",\"color\":\"\\u0627\\u0633\\u0648\\u062f\",\"size\":\"5\",\"costPrice\":100,\"sellingPrice\":200,\"qty\":10,\"barcode\":\"883880888276\",\"productId\":\"1\"}]'),(100,'sale',3,NULL,'customer',6,920.00,'2026-02-12 15:43:42','{\"items\":[{\"product_id\":4,\"qty\":1,\"price\":250,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\"},{\"product_id\":4,\"qty\":1,\"price\":250,\"name\":\"\\u062f\\u0628\\u062f\\u0648\\u0628\"},{\"product_id\":6,\"qty\":1,\"price\":350,\"name\":\"\\u062c\\u0627\\u0643\\u064a\\u062a\"}],\"subtotal\":850,\"discount_type\":\"amount\",\"discount_value\":0,\"discount_amount\":0,\"tax_type\":\"percent\",\"tax_value\":0,\"tax_amount\":0,\"shipping\":70,\"total\":920}'),(101,'sale',3,2,'employee',2,2970.00,'2026-02-12 16:03:16','{\"orders\":[30,31,32],\"rep_id\":2,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}'),(102,'sale',NULL,NULL,'employee',2,850.00,'2026-02-12 16:18:11','{\"order_id\":30,\"action\":\"returned\"}'),(103,'sale',3,2,'employee',13,3020.00,'2026-02-12 18:40:25','{\"orders\":[14,15,16,17],\"rep_id\":13,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\"}'),(104,'sale',NULL,NULL,'employee',13,350.00,'2026-02-12 18:40:50','{\"order_id\":14,\"action\":\"returned\"}'),(105,'sale',NULL,NULL,'employee',13,-350.00,'2026-02-12 18:40:59','{\"order_id\":16,\"action\":\"partial_delivered\",\"delivered\":350}'),(106,'sale',NULL,NULL,'employee',13,650.00,'2026-02-12 18:40:59','{\"order_id\":16,\"action\":\"partial_returned\",\"returned\":650}'),(107,'sale',NULL,NULL,'employee',13,-1000.00,'2026-02-12 18:41:07','{\"order_id\":15,\"action\":\"delivered\"}'),(108,'sale',NULL,NULL,'employee',13,-1000.00,'2026-02-12 18:41:07','{\"order_id\":17,\"action\":\"delivered\"}'),(109,'sale',NULL,2,'employee',2,1980.00,'2026-02-12 19:45:38','{\"orders\":[32,31],\"rep_id\":2,\"reason\":\"\"}'),(110,'payment_out',NULL,2,'employee',2,15000.00,'2026-02-12 19:45:38','{\"direction\":\"out\"}'),(111,'payment_in',NULL,2,'employee',NULL,50000.00,'2026-02-12 20:36:55','{\"notes\":\"\\u062a\\u062c\\u0631\\u0628\\u0647\",\"subtype\":\"deposit\"}'),(112,'payment_in',NULL,2,'customer',13,-2670.00,'2026-02-12 20:41:47','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0647\",\"subtype\":\"rep_settlement\",\"insurance_amount\":1000}'),(113,'payment_in',NULL,NULL,'customer',13,1000.00,'2026-02-12 20:41:47','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\u0627\\u0644\\u062a\\u0623\\u0645\\u064a\\u0646 \\u0636\\u0645\\u0646 \\u062a\\u0635\\u0641\\u064a\\u0629 \\u0627\\u0644\\u062d\\u0633\\u0627\\u0628\",\"subtype\":\"rep_insurance_apply\"}'),(114,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:44:17','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0647\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(115,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:44:44','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(116,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:46:05','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(117,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:49:22','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(118,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:50:08','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(119,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:52:38','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(120,'payment_in',NULL,NULL,'customer',13,-670.00,'2026-02-12 20:55:27','{\"notes\":\"1123123\",\"subtype\":\"rep_penalty\"}'),(121,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:57:03','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(122,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:57:47','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(123,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 20:58:44','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(124,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 21:19:13','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(125,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 21:22:54','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(126,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 23:39:55','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(127,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-12 23:40:44','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(128,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-13 00:17:02','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(129,'payment_in',NULL,2,'customer',13,-1670.00,'2026-02-13 00:23:49','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(130,'sale',3,NULL,'employee',13,-3760.00,'2026-02-13 12:59:49','{\"orders\":[28,27,26,29],\"rep_id\":13,\"reason\":\"\\u0628\\u062f\\u0621 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0647\",\"model\":\"consignment\"}'),(131,'payment_in',3,2,'employee',13,2000.00,'2026-02-13 12:59:49','{\"direction\":\"in\",\"orders\":[28,27,26,29],\"rep_id\":13,\"assignment_tx_id\":\"130\",\"model\":\"consignment\"}'),(132,'sale',3,NULL,'employee',13,-2670.00,'2026-02-13 13:15:11','{\"orders\":[18,19,20],\"rep_id\":13,\"reason\":\"\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u064a\\u0647\",\"model\":\"consignment\"}'),(133,'payment_in',NULL,NULL,'employee',13,650.00,'2026-02-13 13:16:01','{\"order_id\":18,\"action\":\"partial_returned\",\"returned\":650,\"model\":\"consignment\"}'),(134,'payment_in',NULL,2,'employee',13,2110.00,'2026-02-13 13:46:49','{\"action\":\"settleDaily\",\"rep_id\":13,\"treasury_id\":2,\"paidAmount\":2110,\"model\":\"consignment\"}'),(135,'payment_in',NULL,2,'employee',NULL,50000.00,'2026-02-13 14:22:23','{\"notes\":\"\\u0634\\u0633\\u064a\\u0634\\u0633\\u064a\",\"subtype\":\"deposit\"}'),(136,'payment_in',NULL,2,'customer',2,-36632.00,'2026-02-13 14:22:44','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":2000}'),(137,'payment_in',NULL,2,'employee',NULL,50000.00,'2026-02-13 14:54:57','{\"notes\":\"616516516\",\"subtype\":\"deposit\"}'),(138,'payment_in',NULL,2,'customer',2,-34632.00,'2026-02-13 14:55:21','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(139,'payment_in',NULL,2,'customer',2,-34632.00,'2026-02-13 15:04:41','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}'),(140,'payment_in',NULL,2,'employee',NULL,100000.00,'2026-02-13 15:09:47','{\"notes\":\"\\u0634\\u0633\\u064a\\u0634\\u0633\\u064a\\u0634\\u0633\",\"subtype\":\"deposit\"}'),(141,'payment_in',NULL,2,'employee',2,-34632.00,'2026-02-13 15:10:16','{\"notes\":\"\\u062a\\u0633\\u0648\\u064a\\u0629 \\/ \\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0627\\u0628 \\u0627\\u0644\\u0645\\u0646\\u062f\\u0648\\u0628\",\"subtype\":\"rep_settlement\",\"insurance_amount\":0}');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `treasuries`
--

DROP TABLE IF EXISTS `treasuries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `treasuries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_balance` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `treasuries`
--

LOCK TABLES `treasuries` WRITE;
/*!40000 ALTER TABLE `treasuries` DISABLE KEYS */;
INSERT INTO `treasuries` VALUES (1,'الخزينه الاخرى',4000.00),(2,'الخزينه الرئيسيه',73916.00),(3,'تأمين المناديب',1000.00);
/*!40000 ALTER TABLE `treasuries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_defaults`
--

DROP TABLE IF EXISTS `user_defaults`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_defaults` (
  `user_id` int(11) NOT NULL,
  `default_warehouse_id` int(11) DEFAULT NULL,
  `default_treasury_id` int(11) DEFAULT NULL,
  `can_change_warehouse` tinyint(1) DEFAULT '0',
  `can_change_treasury` tinyint(1) DEFAULT '0',
  `default_sales_office_id` int(11) DEFAULT NULL,
  `can_change_sales_office` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_defaults`
--

LOCK TABLES `user_defaults` WRITE;
/*!40000 ALTER TABLE `user_defaults` DISABLE KEYS */;
INSERT INTO `user_defaults` VALUES (1,NULL,NULL,1,1,NULL,0);
/*!40000 ALTER TABLE `user_defaults` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci,
  `data` longtext COLLATE utf8mb4_unicode_ci,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `is_read` (`is_read`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notifications`
--

LOCK TABLES `user_notifications` WRITE;
/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
INSERT INTO `user_notifications` VALUES (1,2,'receive_dispatch','تنبيه استلام','يوجد إرسال جديد للاستلام: DSP-20260208-00003 — من: المخزن إلى: المخزن التانى','{\"type\":\"receive_dispatch\",\"order_id\":3,\"code\":\"DSP-20260208-00003\",\"from_warehouse_id\":3,\"to_warehouse_id\":2}',0,'2026-02-08 04:22:28'),(2,2,'receive_dispatch','تنبيه استلام','يوجد إرسال جديد للاستلام: DSP-20260208-00004 — من: المخزن إلى: المخزن التانى','{\"type\":\"receive_dispatch\",\"order_id\":4,\"code\":\"DSP-20260208-00004\",\"from_warehouse_id\":3,\"to_warehouse_id\":2}',0,'2026-02-08 04:43:31'),(3,2,'receive_dispatch','تنبيه استلام','يوجد إرسال جديد للاستلام: DSP-20260208-00005 — من: المخزن إلى: المخزن التانى','{\"type\":\"receive_dispatch\",\"order_id\":5,\"code\":\"DSP-20260208-00005\",\"from_warehouse_id\":3,\"to_warehouse_id\":2}',0,'2026-02-08 05:15:20');
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_page_permissions`
--

DROP TABLE IF EXISTS `user_page_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_page_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `page_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_access` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`page_slug`),
  CONSTRAINT `user_page_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_page_permissions`
--

LOCK TABLES `user_page_permissions` WRITE;
/*!40000 ALTER TABLE `user_page_permissions` DISABLE KEYS */;
INSERT INTO `user_page_permissions` VALUES (1,1,'dashboard',1),(2,1,'crm',1),(3,1,'srm',1),(4,1,'inventory',1),(5,1,'orders',1),(6,1,'reps',1),(7,1,'hrm',1),(8,1,'finance',1),(9,1,'admin',1),(10,1,'settings',1),(11,1,'customers',1),(12,1,'suppliers',1),(13,1,'manufacturing-management',1);
/*!40000 ALTER TABLE `user_page_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `action_id` int(11) NOT NULL,
  `allowed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_module_action` (`user_id`,`module_id`,`action_id`),
  KEY `user_id` (`user_id`),
  KEY `module_id` (`module_id`),
  KEY `action_id` (`action_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2313 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
INSERT INTO `user_permissions` VALUES (271,1,1,1,1),(272,1,1,3,1),(273,1,1,5,1),(274,1,1,4,1),(275,1,1,2,1),(276,1,3,1,1),(277,1,3,3,1),(278,1,3,5,1),(279,1,3,4,1),(280,1,3,2,1),(281,1,4,1,1),(282,1,4,3,1),(283,1,4,5,1),(284,1,4,4,1),(285,1,4,2,1),(286,1,5,1,1),(287,1,5,3,1),(288,1,5,5,1),(289,1,5,4,1),(290,1,5,2,1),(291,1,6,1,1),(292,1,6,3,1),(293,1,6,5,1),(294,1,6,4,1),(295,1,6,2,1),(296,1,7,1,1),(297,1,7,3,1),(298,1,7,5,1),(299,1,7,4,1),(300,1,7,2,1),(301,1,8,1,1),(302,1,8,3,1),(303,1,8,5,1),(304,1,8,4,1),(305,1,8,2,1),(306,1,9,1,1),(307,1,9,3,1),(308,1,9,5,1),(309,1,9,4,1),(310,1,9,2,1),(311,1,10,1,1),(312,1,10,3,1),(313,1,10,5,1),(314,1,10,4,1),(315,1,10,2,1),(316,1,11,1,1),(317,1,11,3,1),(318,1,11,5,1),(319,1,11,4,1),(320,1,11,2,1),(321,1,12,1,1),(322,1,12,3,1),(323,1,12,5,1),(324,1,12,4,1),(325,1,12,2,1),(326,1,13,1,1),(327,1,13,3,1),(328,1,13,5,1),(329,1,13,4,1),(330,1,13,2,1),(331,1,14,1,1),(332,1,14,3,1),(333,1,14,5,1),(334,1,14,4,1),(335,1,14,2,1),(336,1,15,1,1),(337,1,15,3,1),(338,1,15,5,1),(339,1,15,4,1),(340,1,15,2,1),(341,1,16,1,1),(342,1,16,3,1),(343,1,16,5,1),(344,1,16,4,1),(345,1,16,2,1),(346,1,17,1,1),(347,1,17,3,1),(348,1,17,5,1),(349,1,17,4,1),(350,1,17,2,1),(351,1,18,1,1),(352,1,18,3,1),(353,1,18,5,1),(354,1,18,4,1),(355,1,18,2,1),(356,1,2,1,1),(357,1,2,3,1),(358,1,2,5,1),(359,1,2,4,1),(360,1,2,2,1),(361,1,3,7,1),(362,1,3,6,1),(363,1,4,7,1),(364,1,4,6,1),(365,1,5,7,1),(366,1,5,6,1),(367,1,6,7,1),(368,1,6,6,1),(369,1,7,7,1),(370,1,7,6,1),(371,1,8,7,1),(372,1,8,6,1),(373,1,9,7,1),(374,1,9,6,1),(375,1,10,7,1),(376,1,10,6,1),(377,1,11,7,1),(378,1,11,6,1),(379,1,12,7,1),(380,1,12,6,1),(381,1,13,7,1),(382,1,13,6,1),(383,1,14,7,1),(384,1,14,6,1),(385,1,15,7,1),(386,1,15,6,1),(387,1,16,7,1),(388,1,16,6,1),(389,1,17,7,1),(390,1,17,6,1),(391,1,18,7,1),(392,1,18,6,1),(1254,1,67,3,1),(1255,1,67,5,1),(1256,1,67,4,1),(1257,1,67,7,1),(1258,1,67,6,1),(1259,1,67,2,1),(1260,1,68,3,1),(1261,1,68,5,1),(1262,1,68,4,1),(1263,1,68,7,1),(1264,1,68,6,1),(1265,1,68,2,1),(1266,1,69,3,1),(1267,1,69,5,1),(1268,1,69,4,1),(1269,1,69,7,1),(1270,1,69,6,1),(1271,1,69,2,1),(1272,1,70,3,1),(1273,1,70,5,1),(1274,1,70,4,1),(1275,1,70,7,1),(1276,1,70,6,1),(1277,1,70,2,1),(1278,1,71,3,1),(1279,1,71,5,1),(1280,1,71,4,1),(1281,1,71,7,1),(1282,1,71,6,1),(1283,1,71,2,1),(1698,1,72,3,1),(1699,1,72,5,1),(1700,1,72,4,1),(1701,1,72,7,1),(1702,1,72,6,1),(1703,1,72,2,1),(1704,1,73,3,1),(1705,1,73,5,1),(1706,1,73,4,1),(1707,1,73,7,1),(1708,1,73,6,1),(1709,1,73,2,1),(1848,1,74,3,1),(1849,1,74,5,1),(1850,1,74,4,1),(1851,1,74,7,1),(1852,1,74,6,1),(1853,1,74,2,1),(1854,1,75,3,1),(1855,1,75,5,1),(1856,1,75,4,1),(1857,1,75,7,1),(1858,1,75,6,1),(1859,1,75,2,1);
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','manager','representative','accountant') COLLATE utf8mb4_unicode_ci DEFAULT 'representative',
  `restricted_treasury_id` int(11) DEFAULT NULL,
  `restricted_warehouse_id` int(11) DEFAULT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `insurance_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'هل دفع تأمين',
  `insurance_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'مبلغ التأمين المدفوع',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'ممدوح','admin','$2y$10$VOtl.bL/w.uFixB09HTzOuPbUo.vH.NnSXMtSj6ZOZyaowiWguxVq','admin',NULL,NULL,'/uploads/avatars/user_1_20260206_225024.jpg','2026-02-02 00:46:49','01050016289',-706.00,0,0.00),(2,'ممدوح المصرى','dragon','$2y$10$N6xCTsQSVbHSLiF9OJORX.WMx4TBdWX1wK4FaBv1.PYvFFKxQYoF2','representative',NULL,NULL,NULL,'2026-02-02 22:18:55','01150006289',0.00,0,0.00),(13,'مم','rep_260211203400_9292','$2y$10$4bq.F8kS..KP/Ac/dITKmuqxfDSsiTKlc1xSx17iTAWdaaEt/Uc/y','representative',NULL,NULL,NULL,'2026-02-11 19:34:00','54165151',1670.00,0,0.00);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES (2,'المخزن التانى','ششششش'),(3,'المخزن','سسسسس');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `worker_salaries`
--

DROP TABLE IF EXISTS `worker_salaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `worker_salaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `period_type` enum('day','week','month','piecework') COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_value` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_salary` decimal(10,2) NOT NULL,
  `deductions` decimal(10,2) DEFAULT '0.00',
  `bonuses` decimal(10,2) DEFAULT '0.00',
  `net_salary` decimal(10,2) NOT NULL,
  `status` enum('pending','paid') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_worker_period` (`worker_id`,`period_type`,`period_value`),
  CONSTRAINT `worker_salaries_ibfk_1` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `worker_salaries`
--

LOCK TABLES `worker_salaries` WRITE;
/*!40000 ALTER TABLE `worker_salaries` DISABLE KEYS */;
INSERT INTO `worker_salaries` VALUES (2,2,'month','2026-02',12000.00,0.00,0.00,12100.00,'pending',NULL,NULL);
/*!40000 ALTER TABLE `worker_salaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `worker_transactions`
--

DROP TABLE IF EXISTS `worker_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `worker_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','bonus','penalty','piecework','salary') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `worker_id` (`worker_id`),
  CONSTRAINT `worker_transactions_ibfk_1` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `worker_transactions`
--

LOCK TABLES `worker_transactions` WRITE;
/*!40000 ALTER TABLE `worker_transactions` DISABLE KEYS */;
INSERT INTO `worker_transactions` VALUES (1,2,50.00,'piecework','2026-02-08','{\"cutting_order_id\":4,\"product_id\":1,\"stage_id\":1,\"qty\":5,\"type\":\"stage_complete_transfer\"}','deducted','2026-02-08 01:05:50'),(2,2,50.00,'piecework','2026-02-08','{\"cutting_order_id\":3,\"product_id\":2,\"stage_id\":1,\"qty\":5,\"type\":\"stage_complete_transfer\"}','deducted','2026-02-08 01:06:04'),(3,2,50.00,'piecework','2026-02-08','{\"cutting_order_id\":4,\"product_id\":1,\"stage_id\":2,\"qty\":5,\"type\":\"stage_complete_transfer\"}','pending','2026-02-08 03:30:30'),(4,2,50.00,'piecework','2026-02-08','{\"cutting_order_id\":3,\"product_id\":2,\"stage_id\":2,\"qty\":5,\"type\":\"stage_complete_transfer\"}','pending','2026-02-08 03:30:47');
/*!40000 ALTER TABLE `worker_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workers`
--

DROP TABLE IF EXISTS `workers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `workers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salary_type` enum('daily','weekly','monthly','piecework') COLLATE utf8mb4_unicode_ci DEFAULT 'daily',
  `salary_amount` decimal(10,2) DEFAULT '0.00',
  `hire_date` date DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fingerprint_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendance_enabled` tinyint(1) DEFAULT '0',
  `default_shift_id` int(11) DEFAULT NULL,
  `status` enum('active','inactive','on_leave') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fingerprint_no` (`fingerprint_no`) USING BTREE,
  KEY `idx_workers_fingerprint_no` (`fingerprint_no`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workers`
--

LOCK TABLES `workers` WRITE;
/*!40000 ALTER TABLE `workers` DISABLE KEYS */;
INSERT INTO `workers` VALUES (2,'عامل رقم 1','خياطه','weekly',3000.00,'2026-02-01','01150006289','144',0,NULL,'active','2026-02-08 00:53:57');
/*!40000 ALTER TABLE `workers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-13 21:20:05
