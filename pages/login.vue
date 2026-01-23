<script setup>
definePageMeta({ layout: 'none' });
const route = useRoute();
const errorMsg = ref('');

onMounted(() => {
  const code = route.query.error;

  if (code === 'unauthorized_domain') errorMsg.value = "Acceso no autorizado para este dominio.";
  if (code === 'unauthorized_email') errorMsg.value = "Usuario no registrado en el sistema.";
  if (code === 'server_error') errorMsg.value = "Error de conexión temporal.";
  if (code === 'no_code') errorMsg.value = "Inicio de sesión cancelado.";

  // NEW: more accurate than "conexión"
  if (code === 'oauth_client') {
    errorMsg.value =
      "Error de configuración de inicio de sesión (OAuth). Verifica Client ID/Secret y reinicia el servidor.";
  }
});
</script>
