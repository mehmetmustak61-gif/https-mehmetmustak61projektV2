$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$hostName = "localhost"
$port = 8000
$address = [System.Net.IPAddress]::Loopback

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".gif" { "image/gif" }
    ".svg" { "image/svg+xml" }
    ".ico" { "image/x-icon" }
    default { "application/octet-stream" }
  }
}

function Write-Response(
  [System.IO.Stream]$stream,
  [int]$statusCode,
  [string]$statusText,
  [byte[]]$bodyBytes,
  [string]$contentType
) {
  if (-not $bodyBytes) {
    $bodyBytes = [byte[]]::new(0)
  }
  if (-not $contentType) {
    $contentType = "text/plain; charset=utf-8"
  }

  $header = "HTTP/1.1 $statusCode $statusText`r`n" +
    "Content-Type: $contentType`r`n" +
    "Content-Length: $($bodyBytes.Length)`r`n" +
    "Connection: close`r`n`r`n"

  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bodyBytes.Length -gt 0) {
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
  }
}

$listener = [System.Net.Sockets.TcpListener]::new($address, $port)
$listener.Start()
Write-Host "Serving $root at http://$hostName`:$port/"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)

      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $line = $reader.ReadLine()
        if ($line -eq $null -or $line -eq "") {
          break
        }
      }

      $parts = $requestLine.Split(" ")
      if ($parts.Length -lt 2) {
        $body = [Text.Encoding]::UTF8.GetBytes("400 Bad Request")
        Write-Response -stream $stream -statusCode 400 -statusText "Bad Request" -bodyBytes $body -contentType "text/plain; charset=utf-8"
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      $rawPath = $parts[1]

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [Text.Encoding]::UTF8.GetBytes("405 Method Not Allowed")
        Write-Response -stream $stream -statusCode 405 -statusText "Method Not Allowed" -bodyBytes $body -contentType "text/plain; charset=utf-8"
        continue
      }

      $pathOnly = $rawPath.Split("?")[0]
      $decodedPath = [Uri]::UnescapeDataString($pathOnly)
      if ([string]::IsNullOrWhiteSpace($decodedPath) -or $decodedPath -eq "/") {
        $decodedPath = "/index.html"
      }

      $safeRelative = $decodedPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
      $fullPath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $safeRelative))

      if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        Write-Response -stream $stream -statusCode 403 -statusText "Forbidden" -bodyBytes $body -contentType "text/plain; charset=utf-8"
        continue
      }

      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Write-Response -stream $stream -statusCode 404 -statusText "Not Found" -bodyBytes $body -contentType "text/plain; charset=utf-8"
        continue
      }

      $contentType = Get-ContentType $fullPath
      $bytes = [IO.File]::ReadAllBytes($fullPath)
      if ($method -eq "HEAD") {
        Write-Response -stream $stream -statusCode 200 -statusText "OK" -bodyBytes ([byte[]]::new(0)) -contentType $contentType
      } else {
        Write-Response -stream $stream -statusCode 200 -statusText "OK" -bodyBytes $bytes -contentType $contentType
      }
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
