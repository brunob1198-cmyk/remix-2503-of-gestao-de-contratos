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
echo [2/2] Fazendo deploy da funcao...
cmd /c npx supabase@latest functions deploy contaazul-send-transaction --project-ref xqdhyukmeklfczwiipen --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ERRO no deploy!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Deploy concluido com sucesso!
echo ============================================================
pause
