<?php

$data = $_POST['base64data'];

list($type, $data) = explode(';', $data);
list(, $data)      = explode(',', $data);
$data = base64_decode($data);

$filename = uniqid(rand(), true) . '.png';
file_put_contents('images/' . $filename, $data);

echo $filename;

?>