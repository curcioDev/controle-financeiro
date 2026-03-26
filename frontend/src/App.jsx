import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const handleLogin = (userData, token) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        setUser(userData);
        navigate('/dashboard');
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
    };

    if (loading) return <div style={{ color: 'white', padding: '20px' }}>Carregando...</div>;

    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route
                path="/login"
                element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
            />
            <Route
                path="/*"
                element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            />
        </Routes>
    );
}

export default App;
