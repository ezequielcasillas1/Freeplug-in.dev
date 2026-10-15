import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ERROR_TOO_LARGE, PHOTO_LIMIT_REACHED, PHOTO_REFUSED, ERROR_TOO_MANY_PHOTOS } from '@/lib/outreach/copy'
import type { UploadResult } from '@/lib/outreach/photo-queue'
import { PhotoUploadBox, usePhotoQueue, type PhotoUploader, type SentPhoto } from './PhotoUploadBox'

const MB = 1024 * 1024

// Browser conversion stand-in: file names decide what happens (plain functions, not spies).
vi.mock('@/lib/outreach/client-image', async (orig) => {
  const real = await orig<typeof import('@/lib/outreach/client-image')>()
  return {
    ...real,
    preparePhoto: async (f: File) => {
      if (f.name.startsWith('cannot-decode')) throw new Error('decode')
      if (f.name.startsWith('still-big')) return { size: 5 * MB + 1 } as Blob
      return new Blob(['jpeg-bytes'], { type: 'image/jpeg' })
    },
  }
})

beforeAll(() => {
  URL.createObjectURL = () => 'blob:local'
  URL.revokeObjectURL = () => {}
})

function pick(name: string, type: string, size = 1000) {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const holder: { queue: ReturnType<typeof usePhotoQueue> | null } = { queue: null }
function Harness({ alreadySent = 0, sentPhotos }: { alreadySent?: number; sentPhotos?: SentPhoto[] }) {
  const queue = usePhotoQueue(alreadySent + (sentPhotos?.length ?? 0))
  useEffect(() => {
    holder.queue = queue
  })
  return <PhotoUploadBox label="Upload photos" queue={queue} sentPhotos={sentPhotos} />
}

async function addFiles(files: File[]) {
  await act(async () => {
    await holder.queue!.add(files)
  })
}

describe('photo box', () => {
  it('refused files get a line each, never a thumbnail, and never count or reach the server', async () => {
    render(<Harness />)
    const uploads: string[] = []
    const uploader: PhotoUploader = async (id) => {
      uploads.push(id)
      return { ok: true }
    }
    await addFiles([
      pick('notes.txt', 'text/plain'),
      pick('cannot-decode.heic', 'image/heic', 3 * MB),
      pick('still-big.png', 'image/png', 9 * MB),
      pick('huge.jpg', 'image/jpeg', 11 * MB),
    ])
    expect(screen.getByTestId('photo-count')).toHaveTextContent('0 of 50 photos')
    const lines = screen.getByTestId('photo-refused').querySelectorAll('li')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toHaveTextContent(`notes.txt: ${PHOTO_REFUSED}`)
    expect(lines[1]).toHaveTextContent(`cannot-decode.heic: ${PHOTO_REFUSED}`)
    expect(lines[2]).toHaveTextContent(`still-big.png: ${PHOTO_REFUSED}`)
    expect(lines[3]).toHaveTextContent(`huge.jpg: ${ERROR_TOO_LARGE}`)
    expect(screen.queryByTestId('photo-grid')).toBeNull()
    await act(async () => {
      await holder.queue!.uploadAll(uploader)
    })
    expect(uploads).toEqual([])
  })

  it('a good photo next to a refused one counts as 1, uploads once, and shows as uploaded', async () => {
    render(<Harness />)
    const uploads: string[] = []
    const uploader: PhotoUploader = async (id): Promise<UploadResult> => {
      uploads.push(id)
      return { ok: true, photoId: 'server-1' }
    }
    await addFiles([pick('cannot-decode.heic', 'image/heic'), pick('yard.jpg', 'image/jpeg')])
    expect(screen.getByTestId('photo-count')).toHaveTextContent('1 of 50 photos')
    await act(async () => {
      await holder.queue!.uploadAll(uploader)
    })
    expect(uploads).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('photo-grid').querySelector('li')).toHaveAttribute('data-status', 'done'))
  })

  it('stops at 50 across earlier sends and greys out the box with the limit message', async () => {
    render(<Harness alreadySent={48} />)
    expect(screen.getByTestId('photo-count')).toHaveTextContent('48 of 50 photos')
    await addFiles([pick('a.jpg', 'image/jpeg'), pick('b.jpg', 'image/jpeg'), pick('c.jpg', 'image/jpeg')])
    expect(screen.getByTestId('photo-count')).toHaveTextContent('50 of 50 photos')
    expect(screen.getByText(ERROR_TOO_MANY_PHOTOS)).toBeInTheDocument()
    expect(screen.getByTestId('photo-limit')).toHaveTextContent(PHOTO_LIMIT_REACHED)
    expect(screen.queryByLabelText('Upload photos', { selector: 'input' })).toBeNull()
  })

  it('shows two rows, then "Show all {n} photos", which expands in place', async () => {
    render(<Harness />)
    await addFiles(Array.from({ length: 12 }, (_, i) => pick(`p${i}.jpg`, 'image/jpeg')))
    const items = screen.getByTestId('photo-grid').querySelectorAll('li')
    expect(items).toHaveLength(12)
    const hiddenClass = /(^|\s)hidden(\s|$)/
    expect(items[5].className).not.toMatch(hiddenClass)
    expect(items[6].className).toContain('hidden md:block')
    expect(items[10].className).toMatch(hiddenClass)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12 photos' }))
    expect(screen.getByTestId('photo-grid').querySelectorAll('li')[10].className).not.toMatch(hiddenClass)
    expect(screen.getByRole('button', { name: 'Show fewer photos' })).toBeInTheDocument()
  })

  it('the upload box button reads "+ Add photos" (Sable 12:38 AM)', () => {
    render(<Harness />)
    const box = screen.getByLabelText('Upload photos', { selector: 'input' }).closest('label')!
    // "+" then "Add photos" (the gap is a margin).
    expect(box.textContent).toMatch(/^\+\s*Add photos$/)
  })

  it('numbers the screen-reader labels (Sable 12:35 AM)', async () => {
    render(<Harness />)
    await addFiles([pick('a.jpg', 'image/jpeg'), pick('b.jpg', 'image/jpeg')])
    expect(screen.getByRole('button', { name: 'Remove photo 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove photo 2' })).toBeInTheDocument()
    await act(async () => {
      await holder.queue!.uploadAll(async () => ({ ok: true }))
    })
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo 2 uploaded' })).toBeInTheDocument())
  })
})

describe('photos carried over from the preview (claim step 2, Lina Sep 27)', () => {
  const carried: SentPhoto[] = [
    { id: 'c1', url: 'https://storage.test/c1.jpg?sig' },
    { id: 'c2', url: 'https://storage.test/c2.jpg?sig' },
    { id: 'c3', url: 'https://storage.test/c3.jpg?sig' },
  ]

  it('show as uploaded, count toward the total, and cannot be removed', () => {
    render(<Harness sentPhotos={carried} />)
    expect(screen.getByTestId('photo-count')).toHaveTextContent('3 of 50 photos')
    const items = screen.getByTestId('photo-grid').querySelectorAll('li')
    expect(items).toHaveLength(3)
    items.forEach((li) => {
      expect(li).toHaveAttribute('data-status', 'done')
      expect(li).toHaveAttribute('data-carried', 'true')
      expect(li.querySelector('button')).toBeNull()
    })
    expect(items[0].querySelector('img')).toHaveAttribute('src', carried[0].url)
  })

  it('new photos add to the carried count, and the cap counts both', async () => {
    render(<Harness sentPhotos={carried} />)
    await addFiles(Array.from({ length: 48 }, (_, i) => pick(`n${i}.jpg`, 'image/jpeg')))
    expect(screen.getByTestId('photo-count')).toHaveTextContent('50 of 50 photos')
    expect(screen.getByText(ERROR_TOO_MANY_PHOTOS)).toBeInTheDocument()
  })

  it('grid order: failed first, then carried, then new', async () => {
    render(<Harness sentPhotos={carried.slice(0, 1)} />)
    await addFiles([pick('ok.jpg', 'image/jpeg'), pick('bad.jpg', 'image/jpeg')])
    let n = 0
    await act(async () => {
      await holder.queue!.uploadAll(async () => (n++ === 1 ? { ok: false, code: 'expired' } : { ok: true }))
    })
    await waitFor(() => {
      const items = [...screen.getByTestId('photo-grid').querySelectorAll('li')]
      expect(items.map((li) => (li.getAttribute('data-carried') ? 'carried' : li.getAttribute('data-status')))).toEqual(['failed', 'carried', 'done'])
    })
  })
})

describe('tap targets (Vera QA #6)', () => {
  it('the remove "x" has a 44x44 tap area in the top-right corner (small visible circle)', async () => {
    render(<Harness />)
    await addFiles([pick('a.jpg', 'image/jpeg'), pick('notes.txt', 'text/plain')])
    const remove = screen.getByTestId('photo-remove')
    for (const c of ['h-11', 'w-11', 'absolute', 'right-0', 'top-0']) expect(remove.classList.contains(c)).toBe(true)
    expect(remove.querySelector('span')?.className).toContain('h-7 w-7')
    const dismiss = screen.getByTestId('photo-refused-dismiss')
    for (const c of ['h-11', 'w-11']) expect(dismiss.classList.contains(c)).toBe(true)
  })

  it('the refused-file dismiss button is named after the file (Vera r2 bug 7, Sable 1:18 AM)', async () => {
    render(<Harness />)
    await addFiles([pick('a.jpg', 'image/jpeg'), pick('notes.txt', 'text/plain')])
    const dismiss = screen.getByRole('button', { name: 'Dismiss message about notes.txt' })
    expect(dismiss).toBe(screen.getByTestId('photo-refused-dismiss'))
    // The grid's own photo keeps "Remove photo 1"; nothing else says "Remove photo".
    expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(1)
    fireEvent.click(dismiss)
    expect(screen.queryByTestId('photo-refused')).toBeNull()
  })

  it('a photo over the upload limit is never sent (the server would refuse the body)', async () => {
    render(<Harness />)
    await addFiles([pick('a.jpg', 'image/jpeg')])
    const photo = holder.queue!.photos[0]
    Object.defineProperty(photo.blob, 'size', { value: 5 * MB + 1 })
    const uploads: string[] = []
    await act(async () => {
      await holder.queue!.uploadAll(async (id) => (uploads.push(id), { ok: true }))
    })
    expect(uploads).toEqual([])
    await waitFor(() => expect(screen.getByTestId('photo-grid').querySelector('li')).toHaveAttribute('data-status', 'failed'))
  })
})

