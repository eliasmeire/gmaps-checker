<?php

	$key = 'AIzaSyAPIecFNbTbIQH9lsCIZjEeudusnBP5ITc';
	$start = isset($_GET['start']) ? $_GET['start'] : '';
	$dest = isset($_GET['destination']) ? $_GET['destination'] : '';
	$mode = isset($_GET['mode']) ? $_GET['mode'] : '';
	$url = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' . urlencode($start) . '&destinations=' . urlencode($dest) . '&key='. urlencode($key) .'&mode=' . urlencode($mode) . '&departure_time=now';
	echo file_get_contents($url);
	
?>