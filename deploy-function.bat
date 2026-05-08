@echo off
echo ============================================================
echo  DEPLOY - contaazul-send-transaction
echo ============================================================
echo.
echo Este script vai:
echo  1. Fazer login no Supabase (abre o browser)
echo  2. Fazer deploy da funcao corrigida
echo.
echo Pressione qualquer tecla para continuar...
pause > nul

echo.
echo [1/2] Fazendo login no Supabase...
cmd /c npx --yes supabase@latest login
if %ERRORLEVEL% neq 0 (
    echo ERRO no login! Tente manualmente: npx supabase login
    pause
    exit /b 1
)

echo.
echo [2/3] Fazendo deploy da funcao contaazul-send-transaction...
cmd /c npx supabase@latest functions deploy contaazul-send-transaction --project-ref xqdhyukmeklfczwiipen --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ERRO no deploy da funcao contaazul-send-transaction!
    pause
    exit /b 1
)

echo.
echo [3/3] Fazendo deploy da funcao contaazul-metadata (lista as contas financeiras atualizadas na tela)...
cmd /c npx supabase@latest functions deploy contaazul-metadata --project-ref xqdhyukmeklfczwiipen --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ERRO no deploy da funcao contaazul-metadata!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Deploy concluido com sucesso!
echo ============================================================
pause
