import { iniciarSesion } from '../auth.js';

export function montarLogin(contenedor) {
  contenedor.innerHTML = `
    <form id="form-login" style="max-width:320px;margin:4rem auto;display:flex;flex-direction:column;gap:0.75rem;">
      <h1>Monitor de Stock</h1>
      <input type="email" id="login-email" placeholder="Email" required autocomplete="username" />
      <input type="password" id="login-password" placeholder="Contraseña" required autocomplete="current-password" />
      <button type="submit">Entrar</button>
      <p id="login-error" style="color:#c0392b;"></p>
    </form>
  `;

  const form = contenedor.querySelector('#form-login');
  const errorEl = contenedor.querySelector('#login-error');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorEl.textContent = '';
    const email = contenedor.querySelector('#login-email').value;
    const password = contenedor.querySelector('#login-password').value;
    try {
      await iniciarSesion(email, password);
    } catch (error) {
      errorEl.textContent = 'Credenciales incorrectas o error de conexión.';
    }
  });
}
