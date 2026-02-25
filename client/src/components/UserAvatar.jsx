import React from 'react';

const UserAvatar = ({ user, isYou }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: 'white', border: isYou ? '2px solid #22c55e' : 'none', boxSizing: 'border-box' }} title={user.name}>{getInitials(user.name)}</div>
  );
};

export default UserAvatar;
