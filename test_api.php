<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['module'] = 'sales';
$_GET['action'] = 'getJournalOrders';
$_GET['rep_id'] = '1';
$_GET['journal_id'] = '1';
require 'config.php';
require 'components/api.php';
