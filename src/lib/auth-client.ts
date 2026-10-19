'use client'

import { createAuthClient } from 'better-auth/react'

// Browser-side client. Same origin, so no baseURL.
export const { signIn, signUp, signOut, useSession } = createAuthClient()
