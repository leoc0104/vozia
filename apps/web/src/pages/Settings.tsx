import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Alert, Button, Card, CardBody, Field, Input, Progress } from '../components/ui'
import { updateProfile } from '../lib/api'
import { useAuthStore } from '../stores/auth-store'

export function SettingsPage() {
  const { profile, user, signOut } = useAuthStore()
  return (
    <Card>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          <Field label="Display name" htmlFor="display-name">
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={email} disabled />
          </Field>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
