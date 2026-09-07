import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // NEW: State for Course and Section dropdowns
  const [course, setCourse] = useState('s2');
  const [section, setSection] = useState('1A');
  
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // Auto-assign admin role to you
        const assignedRole =
          email.toLowerCase() === 'scott.scalici@uticak12.org'
            ? 'admin'
            : 'student';

        // NEW: Course and Section added to Firestore payload
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          firstName: firstName,
          lastName: lastName,
          role: assignedRole,
          course: course,
          section: section,
          highest_pod_reached: 0,
          current_path_points: 0,
          created_at: new Date().toISOString(),
        });

        alert('¡Cuenta creada! Welcome to the Gym.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const role = userSnap.exists() ? userSnap.data().role : 'student';
        alert(`¡Acceso concedido!`);
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use')
        setError('Este correo ya está registrado.');
      else if (err.code === 'auth/wrong-password')
        setError('Contraseña incorrecta.');
      else setError('Credenciales incorrectas. Inténtalo de nuevo.');
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError(
        'Por favor, ingresa tu email primero para restablecer la contraseña.'
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('¡Correo enviado! Revisa tu bandeja de entrada.');
      setError(null);
    } catch (err) {
      setError('Error. Verifica que tu correo esté escrito correctamente.');
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '50px auto',
        padding: '20px',
        fontFamily: 'sans-serif',
        border: '2px solid #ccc',
        borderRadius: '10px',
        backgroundColor: '#f8fafc',
      }}
    >
      <h2 style={{ textAlign: 'center', color: '#1e293b' }}>
        {isRegistering ? 'Crear Cuenta 📝' : 'Acceso Estudiante 🔑'}
      </h2>

      {message && (
        <p
          style={{
            color: 'green',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {message}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        {isRegistering && (
          <>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontWeight: 'bold',
                    display: 'block',
                    marginBottom: '5px',
                  }}
                >
                  Nombre
                </label>
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    boxSizing: 'border-box',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontWeight: 'bold',
                    display: 'block',
                    marginBottom: '5px',
                  }}
                >
                  Apellido
                </label>
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    boxSizing: 'border-box',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                  }}
                />
              </div>
            </div>

            {/* NEW: Course and Section Dropdowns */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontWeight: 'bold',
                    display: 'block',
                    marginBottom: '5px',
                  }}
                >
                  Curso
                </label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    boxSizing: 'border-box',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="s2">Español II</option>
                  <option value="s4">IB Español B II</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontWeight: 'bold',
                    display: 'block',
                    marginBottom: '5px',
                  }}
                >
                  Sección
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    boxSizing: 'border-box',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="4A">4A</option>
                  <option value="1B">1B</option>
                  <option value="4B">4B</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div>
          <label
            style={{
              fontWeight: 'bold',
              display: 'block',
              marginBottom: '5px',
            }}
          >
            Email Escolar
          </label>
          <input
            type="email"
            placeholder="estudiante@escuela.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              boxSizing: 'border-box',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div>
          <label
            style={{
              fontWeight: 'bold',
              display: 'block',
              marginBottom: '5px',
            }}
          >
            Contraseña
          </label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              boxSizing: 'border-box',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        {error && (
          <p
            style={{
              color: 'red',
              fontSize: '14px',
              fontWeight: 'bold',
              margin: '0',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          style={{
            backgroundColor: '#2c3e50',
            color: 'white',
            padding: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '5px',
            marginTop: '10px',
          }}
        >
          {isRegistering ? 'REGISTRARSE ➔' : 'ENTRAR AL GIMNASIO ➔'}
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '20px',
          textAlign: 'center',
        }}
      >
        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError(null);
            setMessage(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontWeight: 'bold',
            textDecoration: 'underline',
          }}
        >
          {isRegistering
            ? '¿Ya tienes cuenta? Inicia sesión aquí.'
            : '¿No tienes cuenta? Regístrate aquí.'}
        </button>

        {!isRegistering && (
          <button
            onClick={handleResetPassword}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;