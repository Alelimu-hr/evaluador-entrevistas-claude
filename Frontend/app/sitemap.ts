import { MetadataRoute } from 'next';

// Solo las rutas públicas (sin login) van acá — las herramientas en sí
// (/cv, /linkedin, /simulador, etc.) están detrás del muro de auth y no le
// sirven a nadie que llegue sin cuenta desde un buscador.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://chelaburo.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://chelaburo.com/nosotros',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
