/**
 * Diagnóstico para Auto-Analysis y Detección de Duplicados
 * Script para probar ambas funcionalidades
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 DIAGNÓSTICO DE MEJORAS CODEXR');
console.log('=====================================\n');

console.log('1. 📊 Estado de la extensión compilada:');
const extensionFile = './dist/extension.js';
if (fs.existsSync(extensionFile)) {
    const stats = fs.statSync(extensionFile);
    console.log(`   ✅ Extension compilada: ${Math.round(stats.size / 1024)}KB`);
    console.log(`   📅 Última modificación: ${stats.mtime.toLocaleString()}`);
} else {
    console.log('   ❌ Extension no encontrada en dist/');
}

console.log('\n2. 🔍 Archivos modificados para diagnóstico:');
const modifiedFiles = [
    './src/new_code_analysis/new_engine/core/sessionRegistry.ts',
    './src/new_code_analysis/new_engine/core/sessionManager.ts',
    './src/new_code_analysis/new_engine/analysisOrchestrator.ts',
    './src/new_code_analysis/new_engine/watchers/directoryWatcherOrchestrator.ts',
    './src/new_code_analysis/new_engine/watchers/fileWatcherOrchestrator.ts'
];

modifiedFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${path.basename(file)}`);
    } else {
        console.log(`   ❌ ${path.basename(file)} - NO ENCONTRADO`);
    }
});

console.log('\n3. 🎯 Puntos de diagnóstico agregados:');
console.log('   🔍 sessionRegistry.createSession() - Logs detallados');
console.log('   🔍 sessionRegistry.hasDuplicateSession() - Comparación paso a paso');
console.log('   🔍 sessionManager.startAnalysis() - Parámetros de creación');
console.log('   🔍 analysisOrchestrator.orchestrateAnalysis() - Parámetros');
console.log('   🔍 directoryWatcherOrchestrator.loadDebounceConfiguration() - Auto-analysis check');
console.log('   🔍 fileWatcherOrchestrator.loadDebounceConfiguration() - Auto-analysis check');

console.log('\n4. 🧪 Instrucciones de prueba:');
console.log('   a) Auto-Analysis Enabled/Disabled:');
console.log('      - Ir a Analysis Settings en el panel izquierdo');
console.log('      - Cambiar "Auto-Analysis: Enabled" a "Disabled"');
console.log('      - Modificar un archivo y verificar que NO aparezcan logs de debounce');
console.log('      - Buscar logs: "Auto-Analysis is DISABLED"');

console.log('\n   b) Detección de Sesiones Duplicadas:');
console.log('      - Ejecutar análisis de un mismo archivo/directorio dos veces');
console.log('      - Buscar logs: "DUPLICATE DETECTED" y comparaciones detalladas');
console.log('      - Verificar que la segunda llamada retorne la sesión existente');

console.log('\n📋 Comandos útiles para diagnóstico:');
console.log('   - Abrir Developer Console: Ctrl+Shift+P > "Developer: Toggle Developer Tools"');
console.log('   - Filtrar logs: Buscar "UNIFIED_REGISTRY", "WATCHER_ORCHESTRATOR"');
console.log('   - Recargar ventana: Ctrl+Shift+P > "Developer: Reload Window"');

console.log('\n🚀 ¡Listo para diagnosticar!');
console.log('=====================================\n');
