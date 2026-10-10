import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'

type ProductCategory = 'Accessibility' | 'Technology' | 'Daily Living' | 'Wellness'
type FilterCategory = 'All' | ProductCategory

type Product = {
  id: number
  name: string
  category: ProductCategory
  price: number
  description: string
  image: string
}

const products: Product[] = [
  {
    id: 1,
    name: 'Ergonomic Mouse',
    category: 'Technology',
    price: 799,
    description: 'A comfortable mouse designed for everyday computer use.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 2,
    name: 'Wireless Headphones',
    category: 'Technology',
    price: 1499,
    description: 'Headphones for listening to music, calls, and spoken content.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 3,
    name: 'Digital Voice Recorder',
    category: 'Accessibility',
    price: 1199,
    description: 'A sample voice recording device for notes and reminders.',
    image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 4,
    name: 'Reading Lamp',
    category: 'Daily Living',
    price: 599,
    description: 'A desk lamp for a comfortable reading environment.',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 5,
    name: 'Smart Watch',
    category: 'Wellness',
    price: 1999,
    description: 'A wearable device concept for time and daily activity tracking.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 6,
    name: 'Portable Speaker',
    category: 'Technology',
    price: 999,
    description: 'A compact speaker for listening to audio at home or on the go.',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 7,
    name: 'Large-Print Notebook',
    category: 'Accessibility',
    price: 249,
    description: 'A notebook concept with space for clear, easy-to-read notes.',
    image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 8,
    name: 'Reusable Water Bottle',
    category: 'Daily Living',
    price: 399,
    description: 'A reusable bottle for everyday hydration.',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80',
  },
]

const categories: ReadonlyArray<{ value: FilterCategory; label: string }> = [
  { value: 'All', label: 'All products' },
  { value: 'Accessibility', label: 'Accessibility' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Daily Living', label: 'Daily living' },
  { value: 'Wellness', label: 'Wellness' },
]

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price)

export function ShopPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FilterCategory>('All')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const offSearch = bus.on('VOICE_SEARCH_REQUESTED', ({ query: nextQuery }) => {
      setQuery(nextQuery)
    })
    const offCategory = bus.on('SHOP_CATEGORY_REQUESTED', ({ category: nextCategory }) => {
      setCategory(nextCategory)
      setQuery('')
    })
    const offOpenProduct = bus.on('SHOP_OPEN_PRODUCT_REQUESTED', ({ query: productQuery }) => {
      const normalized = productQuery.toLowerCase().trim()
      const matches = products.filter((product) =>
        product.name.toLowerCase() === normalized,
      )
      if (matches.length === 1) setSelectedProduct(matches[0])
    })
    const offCancel = bus.on('UI_CANCEL_REQUESTED', () => setSelectedProduct(null))

    return () => {
      offSearch()
      offCategory()
      offOpenProduct()
      offCancel()
    }
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === 'All' || product.category === category
    const matchesSearch = [product.name, product.category, product.description]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
    return matchesCategory && matchesSearch
  })

  useEffect(() => {
    if (!selectedProduct) return

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    closeButtonRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProduct(null)
    }
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      returnFocusRef.current?.focus()
    }
  }, [selectedProduct])

  return (
    <main className="shop-page">
      <div className="shop-heading">
        <span className="section-label">THE DRISHVA COLLECTION</span>
        <h1>Shop useful essentials.</h1>
        <p>Explore a curated demo collection in a simple, accessible layout.</p>
      </div>

      <div className="shop-tools">
        <input
          className="shop-search"
          type="search"
          placeholder="Search products..."
          aria-label="Search products"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="category-filters" aria-label="Product categories">
        {categories.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`category-button${category === item.value ? ' active' : ''}`}
            aria-pressed={category === item.value}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="product-grid" aria-live="polite">
        {visibleProducts.length ? (
          visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-image-wrap">
                <img
                  className="product-image"
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                />
              </div>
              <div className="product-info">
                <span className="product-category">{product.category}</span>
                <h2 className="product-title">{product.name}</h2>
                <p className="product-description">{product.description}</p>
                <div className="product-bottom">
                  <span className="product-price">{formatPrice(product.price)}</span>
                  <button
                    type="button"
                    className="product-button"
                    onClick={(event) => {
                      returnFocusRef.current = event.currentTarget
                      setSelectedProduct(product)
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-message">No products found. Try another search.</p>
        )}
      </div>

      {selectedProduct ? (
        <div
          className="product-modal open"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null)
          }}
        >
          <section
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            aria-describedby="product-dialog-description"
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="modal-close"
              aria-label="Close product details"
              onClick={() => setSelectedProduct(null)}
            >
              ×
            </button>
            <div className="product-image-wrap">
              <img
                className="product-image"
                src={selectedProduct.image}
                alt={selectedProduct.name}
              />
            </div>
            <span className="product-category">{selectedProduct.category}</span>
            <h2 id="product-dialog-title">{selectedProduct.name}</h2>
            <p id="product-dialog-description">{selectedProduct.description}</p>
            <div className="product-price">{formatPrice(selectedProduct.price)}</div>
            <p>This is a demonstration listing. No purchase is made.</p>
          </section>
        </div>
      ) : null}
    </main>
  )
}