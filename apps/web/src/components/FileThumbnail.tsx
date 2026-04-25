import { useState } from 'react'
import { FilmIcon } from './icons/FilmIcon'
import { ImageIcon } from './icons/ImageIcon'

interface FileThumbnailProps {
  name: string
  mimeType: string
  src?: string
}

export function FileThumbnail({ name, mimeType, src }: FileThumbnailProps) {
  const [imgError, setImgError] = useState(false)
  const isImage = mimeType.startsWith('image/')

  return (
    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mt-0.5">
      {isImage && src && !imgError ? (
        <img
          src={src}
          alt={`Preview of ${name}`}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : isImage ? (
        <ImageIcon />
      ) : (
        <FilmIcon />
      )}
    </div>
  )
}
