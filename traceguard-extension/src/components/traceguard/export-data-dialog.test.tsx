import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { ExportDataDialog } from './export-data-dialog'

const exportAllData = vi.hoisted(() => vi.fn(async () => {}))
const verifyVaultPassword = vi.hoisted(() => vi.fn())

vi.mock('@/lib/export', () => ({ exportAllData }))
vi.mock('@/lib/vault-password', () => ({ verifyVaultPassword }))

const verifiedKey = {} as CryptoKey

describe('ExportDataDialog', () => {
    beforeEach(() => {
        exportAllData.mockClear()
        verifyVaultPassword.mockReset()
    })

    it('rejects a wrong vault password before writing anything', async () => {
        verifyVaultPassword.mockResolvedValue({ ok: false, reason: 'invalid' })
        render(<ExportDataDialog open onOpenChange={() => {}} />)

        fireEvent.change(screen.getByLabelText('Vault password'), { target: { value: 'wrong' } })
        fireEvent.click(screen.getByRole('button', { name: 'Export' }))

        expect(await screen.findByText('Incorrect vault password.')).toBeInTheDocument()
        expect(exportAllData).not.toHaveBeenCalled()
    })

    it('exports an encrypted backup with the verified vault key', async () => {
        verifyVaultPassword.mockResolvedValue({ ok: true, key: verifiedKey })
        render(<ExportDataDialog open onOpenChange={() => {}} />)

        fireEvent.change(screen.getByLabelText('Vault password'), { target: { value: 'correct' } })
        fireEvent.click(screen.getByRole('button', { name: 'Export' }))

        await waitFor(() => expect(exportAllData).toHaveBeenCalledWith('correct', verifiedKey))
        expect(verifyVaultPassword).toHaveBeenCalledWith('correct')
    })

    it('requires the vault password for a plaintext export too', async () => {
        render(<ExportDataDialog open onOpenChange={() => {}} />)

        fireEvent.click(screen.getByRole('switch'))
        fireEvent.click(screen.getByRole('button', { name: 'Export unencrypted' }))

        expect(await screen.findByText('Enter your vault password to confirm the export.')).toBeInTheDocument()
        expect(verifyVaultPassword).not.toHaveBeenCalled()
        expect(exportAllData).not.toHaveBeenCalled()
    })
})
