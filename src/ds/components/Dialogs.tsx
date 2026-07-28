import { Modal } from './Modal'
import { Button } from './Button'
import { Field } from './Field'
import { useState } from 'react'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <Modal open={isOpen} title={title} onClose={onCancel}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <p style={{ margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel}>{cancelText}</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  )
}

export interface PromptModalProps {
  isOpen: boolean
  title: string
  message: string
  expectedValue: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function PromptModal({
  isOpen,
  title,
  message,
  expectedValue,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: PromptModalProps) {
  const [value, setValue] = useState('')

  const handleConfirm = () => {
    if (value === expectedValue) {
      onConfirm()
      setValue('')
    }
  }

  const handleCancel = () => {
    onCancel()
    setValue('')
  }

  return (
    <Modal open={isOpen} title={title} onClose={handleCancel}>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 var(--space-md) 0', whiteSpace: 'pre-wrap' }}>{message}</p>
        <Field 
          label={`Type '${expectedValue}' to confirm`} 
          value={value} 
          onChange={e => setValue(e.target.value)} 
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={handleCancel}>{cancelText}</Button>
        <Button variant="danger" disabled={value !== expectedValue} onClick={handleConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  )
}

export interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string
  buttonText?: string
  onClose: () => void
}

export function AlertModal({
  isOpen,
  title,
  message,
  buttonText = 'OK',
  onClose
}: AlertModalProps) {
  return (
    <Modal open={isOpen} title={title} onClose={onClose}>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <p style={{ margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={onClose}>{buttonText}</Button>
      </div>
    </Modal>
  )
}
