# ============================================================
#  Gestion Ecole - Installation Docker (Windows)
#  Prerequis : Docker Desktop installe et demarre
#  Executer  : .\install.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Gestion Ecole - Installation Docker     " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verification de Docker
Write-Host "[1/5] Verification de Docker..." -ForegroundColor Yellow
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker non disponible" }
    Write-Host "      Docker Desktop est actif." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERREUR : Docker Desktop n'est pas demarre." -ForegroundColor Red
    Write-Host "  Lancez Docker Desktop puis relancez ce script." -ForegroundColor Red
    Write-Host ""
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# 2. Fichier .env
Write-Host "[2/5] Configuration de l'environnement..." -ForegroundColor Yellow

$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    # Generer des secrets securises avec PowerShell
    $chars  = (65..90) + (97..122) + (48..57)
    $dbPass = -join ($chars | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    $jwtSec = -join ($chars | Get-Random -Count 48 | ForEach-Object { [char]$_ })

    # Detecter l'IP locale automatiquement
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^127\." -and $_.PrefixOrigin -eq "Dhcp" } |
        Select-Object -First 1).IPAddress

    if (-not $localIp) { $localIp = "localhost" }

    $envContent = "# Genere automatiquement par install.ps1`r`n"
    $envContent += "DB_NAME=ECOLE`r`n"
    $envContent += "DB_USER=ecole_user`r`n"
    $envContent += "DB_PASSWORD=$dbPass`r`n"
    $envContent += "`r`n"
    $envContent += "JWT_SECRET=$jwtSec`r`n"
    $envContent += "`r`n"
    $envContent += "APP_PORT=80`r`n"
    $envContent += "`r`n"
    $envContent += "CORS_ORIGIN=http://$localIp,http://localhost`r`n"
    $envContent += "`r`n"
    $envContent += "API_RATE_LIMIT_WINDOW_MS=900000`r`n"
    $envContent += "API_RATE_LIMIT_MAX=500`r`n"
    $envContent += "LOGIN_RATE_LIMIT_MAX=20`r`n"
    $envContent += "LOGIN_MAX_FAILED_ATTEMPTS=10`r`n"
    $envContent += "LOGIN_LOCK_DURATION_MINUTES=15`r`n"

    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::ASCII)
    Write-Host "      .env cree (IP detectee : $localIp)" -ForegroundColor Green
} else {
    Write-Host "      .env existant conserve." -ForegroundColor Green
}

# 3. Build
Write-Host "[3/5] Build des images Docker (2-5 min)..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR lors du build." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# 4. Demarrage
Write-Host "[4/5] Demarrage des conteneurs..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR lors du demarrage." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# 5. Attente sante
Write-Host "[5/5] Attente du demarrage de l'application..." -ForegroundColor Yellow
$maxWait = 90
$elapsed = 0
$ready   = $false

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Write-Host "      ... $elapsed s" -ForegroundColor DarkGray
}

# Resultat
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

if ($ready) {
    $corsLine = (Get-Content $envFile | Where-Object { $_ -match "^CORS_ORIGIN=" })
    $localIp  = ($corsLine -split "=", 2)[1].Split(",")[0]

    Write-Host "  Installation reussie !" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Acces local   : http://localhost" -ForegroundColor White
    Write-Host "  Acces reseau  : $localIp" -ForegroundColor White
} else {
    Write-Host "  Conteneurs demarres (l'appli demarre encore)" -ForegroundColor Yellow
    Write-Host "  Attendez 15 sec puis ouvrez : http://localhost" -ForegroundColor White
    Write-Host ""
    Write-Host "  Voir les logs : docker compose logs -f" -ForegroundColor DarkGray
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 6. Creation du compte admin
$createAdmin = Read-Host "Creer le compte administrateur maintenant ? (O/n)"

if ($createAdmin -ne "n" -and $createAdmin -ne "N") {
    Write-Host ""
    Write-Host "=== Creation du compte administrateur ===" -ForegroundColor Cyan
    Write-Host ""

    $adminEmail  = Read-Host "Email"
    $adminNom    = Read-Host "Nom"
    $adminPrenom = Read-Host "Prenom"
    $adminTel    = Read-Host "Telephone"

    $adminPass   = Read-Host "Mot de passe" -AsSecureString
    $adminPass2  = Read-Host "Confirmer le mot de passe" -AsSecureString

    $pass1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))
    $pass2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass2))

    if ($pass1 -ne $pass2) {
        Write-Host "Erreur : les mots de passe ne correspondent pas." -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }

    docker compose exec `
        -e "ADMIN_EMAIL=$adminEmail" `
        -e "ADMIN_NOM=$adminNom" `
        -e "ADMIN_PRENOM=$adminPrenom" `
        -e "ADMIN_TELEPHONE=$adminTel" `
        -e "ADMIN_PASSWORD=$pass1" `
        backend node scripts/create-admin.js

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Compte admin cree ! Connectez-vous sur : http://localhost" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de la creation du compte." -ForegroundColor Red
    }
}

Write-Host ""
Read-Host "Appuyez sur Entree pour terminer"
