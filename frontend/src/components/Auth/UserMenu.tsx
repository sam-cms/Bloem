/**
 * User Menu for Prebloom
 * 
 * Shows user avatar/email and sign out option when authenticated.
 * Shows sign in button when not authenticated.
 */

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface UserMenuProps {
  onSignInClick: () => void
}

export function UserMenu({ onSignInClick }: UserMenuProps) {
  const { user, loading, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    )
  }

  if (!user) {
    return (
      <button
        onClick={onSignInClick}
        className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors"
      >
        Sign In
      </button>
    )
  }

  // Get initials or first letter of email
  const displayName = user.user_metadata?.full_name || user.email || 'User'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="User menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full border border-white/20"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center text-[#1a1a2e] text-sm font-semibold">
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {/* User info */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border border-white/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center text-[#1a1a2e] font-semibold">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {user.user_metadata?.full_name && (
                  <div className="text-white font-medium truncate">
                    {user.user_metadata.full_name}
                  </div>
                )}
                <div className="text-white/60 text-sm truncate">
                  {user.email}
                </div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            {/* My Ideas - placeholder for future */}
            <button
              onClick={() => {
                setIsOpen(false)
                // TODO: Navigate to history/garden view
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <span>🌱</span>
              <span>My Idea Garden</span>
              <span className="ml-auto text-xs text-white/40">Coming soon</span>
            </button>

            {/* Sign out */}
            <button
              onClick={async () => {
                setIsOpen(false)
                await signOut()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <span>👋</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
