while ($true) {
    git fetch origin
    $local = git rev-parse HEAD
    $remote = git rev-parse origin/main

    if ($local -ne $remote) {
        Write-Host "New commit found. Pulling..."
        git pull origin main
    }

    Start-Sleep -Seconds 15
}
