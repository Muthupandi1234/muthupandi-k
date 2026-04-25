/**
 * Custom Product Popup & Cart Functionality
 * - Handles product popup display
 * - Manages variant selection
 * - Add to cart with special rules
 */

class ProductPopup {
  constructor() {
    this.popup = document.getElementById('productPopup');
    this.popupContent = document.getElementById('popupContent');
    this.popupLoading = document.getElementById('popupLoading');
    this.closeBtn = document.getElementById('closePopup');
    this.currentProduct = null;
    this.selectedVariant = null;

    if (!this.popup || !this.popupContent) {
      console.warn('Popup elements not found');
      return;
    }

    this.init();
  }

  init() {
    this.closeBtn?.addEventListener('click', () => this.closePopup());

    this.popup?.addEventListener('click', (e) => {
      if (e.target === this.popup) {
        this.closePopup();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popup?.classList.contains('active')) {
        this.closePopup();
      }
    });

    this.attachHotspotHandlers();
  }

  attachHotspotHandlers() {
    document.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      const hotspot = target?.closest('.product-card__hotspot');
      if (!hotspot) return;

      e.preventDefault();

      const handle = /** @type {HTMLElement} */ (hotspot).dataset.productHandle;
      if (handle) {
        this.openPopup(handle);
      }
    });
  }

  /** @param {string} productHandle */
  async openPopup(productHandle) {
    if (!this.popup || !this.popupContent) return;

    this.popup.classList.add('active');
    this.popupLoading?.classList.add('active');
    this.popupContent.style.display = 'none';
    document.body.style.overflow = 'hidden';

    try {
      const response = await fetch(`/products/${productHandle}.js`);

      if (!response.ok) throw new Error('Product not found');

      const product = await response.json();

      this.currentProduct = product;

      const firstVariant = Array.isArray(product.variants) ? product.variants[0] : undefined;
      if (!firstVariant) throw new Error('No variants found');

      this.selectedVariant = firstVariant;

      this.renderPopupContent(product);

      this.popupLoading?.classList.remove('active');
      this.popupContent.style.display = 'grid';

    } catch (error) {
      console.error('Error loading product:', error);
      alert('Failed to load product. Please try again.');
      this.closePopup();
    }
  }

  /** @param {{ title: string, featured_image: string, description: string, variants: any[], options: string[] }} product */
  renderPopupContent(product) {
    if (!this.popupContent || !this.selectedVariant) return;

    const options = this.extractOptions(product);

    const html = `
      <div class="product-popup__image-wrapper">
        <img 
          src="${product.featured_image || ''}" 
          alt="${product.title || ''}"
          class="product-popup__image"
        >
      </div>
      
      <div class="product-popup__details">
        <h2 class="product-popup__title">${product.title || ''}</h2>
        
        <div class="product-popup__price" id="variantPrice">
          ${this.formatMoney(this.selectedVariant.price)}
        </div>
        
        <div class="product-popup__description">
          ${product.description || 'No description available.'}
        </div>
        
        <div class="product-popup__variants" id="variantSelectors">
          ${this.renderVariantSelectors(options)}
        </div>
        
        <button 
          class="product-popup__add-to-cart" 
          id="addToCartBtn"
          ${this.selectedVariant.available ? '' : 'disabled'}
        >
          ${this.selectedVariant.available ? 'Add to Cart' : 'Sold Out'}
        </button>
      </div>
    `;

    this.popupContent.innerHTML = html;

    this.attachVariantHandlers();

    document.getElementById('addToCartBtn')?.addEventListener('click', () => {
      this.addToCart();
    });
  }

  /** @param {{ options: string[], variants: Record<string, string>[] }} product */
  extractOptions(product) {
    /** @type {Record<string, string[]>} */
    const optionsMap = {};

    if (!Array.isArray(product.options)) return optionsMap;

    product.options.forEach((/** @type {string} */ option, /** @type {number} */ index) => {
      if (option !== 'Title') {
        /** @type {Set<string>} */
        const valueSet = new Set();

        if (Array.isArray(product.variants)) {
          product.variants.forEach((/** @type {Record<string, string>} */ variant) => {
            const value = variant[`option${index + 1}`];
            if (value) valueSet.add(value);
          });
        }

        optionsMap[option] = Array.from(valueSet);
      }
    });

    return optionsMap;
  }

  /** @param {Record<string, string[]>} options */
  renderVariantSelectors(options) {
    let html = '';

    Object.entries(options).forEach((/** @type {[string, string[]]} */ [optionName, values], /** @type {number} */ index) => {
      html += `
        <div class="variant-option">
          <div class="variant-option__label">${optionName}</div>
          <div class="variant-option__buttons" data-option-index="${index}">
            ${values.map((/** @type {string} */ value) => `
              <button 
                type="button"
                class="variant-option__btn ${this.isOptionSelected(index, value) ? 'active' : ''}"
                data-option-name="${optionName}"
                data-option-value="${value}"
              >
                ${value}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * @param {number} optionIndex
   * @param {string} value
   */
  isOptionSelected(optionIndex, value) {
    if (!this.selectedVariant) return false;
    return this.selectedVariant[`option${optionIndex + 1}`] === value;
  }

  attachVariantHandlers() {
    const buttons = document.querySelectorAll('.variant-option__btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        btn.parentElement?.querySelectorAll('.variant-option__btn')
          .forEach(s => s.classList.remove('active'));

        btn.classList.add('active');

        this.updateSelectedVariant();
      });
    });
  }

  updateSelectedVariant() {
    if (!this.currentProduct) return;

    /** @type {Record<string, string>} */
    const selectedOptions = {};

    document.querySelectorAll('.variant-option__btn.active').forEach(btn => {
      const el = /** @type {HTMLElement} */ (btn);
      const name = el.dataset.optionName;
      const value = el.dataset.optionValue;
      if (name && value) {
        selectedOptions[name] = value;
      }
    });

    const match = Array.isArray(this.currentProduct.variants)
      ? this.currentProduct.variants.find(variant => {
          return Object.entries(selectedOptions).every(([name, value]) => {
            const idx = this.currentProduct.options.indexOf(name) + 1;
            return variant[`option${idx}`] === value;
          });
        })
      : undefined;

    if (!match) return;

    this.selectedVariant = match;

    const priceEl = document.getElementById('variantPrice');
    if (priceEl) {
      priceEl.textContent = this.formatMoney(match.price);
    }

    const btn = document.getElementById('addToCartBtn');
    if (!btn) return;

    if (match.available) {
      btn.removeAttribute('disabled');
      btn.textContent = 'Add to Cart';
    } else {
      btn.setAttribute('disabled', 'true');
      btn.textContent = 'Sold Out';
    }
  }

  async addToCart() {
    if (!this.selectedVariant) return;

    const btn = document.getElementById('addToCartBtn');
    if (!btn) return;

    const originalText = btn.textContent || 'Add to Cart';
    btn.textContent = 'Adding...';
    btn.setAttribute('disabled', 'true');

    try {
      await this.addItemToCart(this.selectedVariant.id, 1);
      await this.checkAndAddBonusProduct();

      btn.textContent = '✓ Added!';

      setTimeout(() => this.closePopup(), 1000);

    } catch (error) {
      console.error('Add to cart error:', error);
      alert('Failed to add to cart. Please try again.');
      btn.textContent = originalText;
      btn.removeAttribute('disabled');
    }
  }

  /**
   * @param {number} variantId
   * @param {number} quantity
   */
  async addItemToCart(variantId, quantity = 1) {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity })
    });

    if (!response.ok) throw new Error('Failed to add to cart');

    return response.json();
  }

  async checkAndAddBonusProduct() {
    if (!this.selectedVariant) return;

    const opts = [
      this.selectedVariant.option1,
      this.selectedVariant.option2,
      this.selectedVariant.option3
    ].map(o => (typeof o === 'string' ? o.toLowerCase() : ''));

    const hasBlack = opts.includes('black');
    const hasMedium = opts.includes('medium');

    if (hasBlack && hasMedium) {
      try {
        const response = await fetch('/products/soft-winter-jacket.js');
        if (!response.ok) return;

        const bonusProduct = await response.json();
        const firstVariant = Array.isArray(bonusProduct.variants) ? bonusProduct.variants[0] : undefined;

        if (firstVariant) {
          await this.addItemToCart(firstVariant.id, 1);
        }
      } catch (error) {
        console.warn('Bonus product failed to add:', error);
      }
    }
  }

  formatMoney(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format((cents || 0) / 100);
  }

  closePopup() {
    if (!this.popup || !this.popupContent) return;

    this.popup.classList.remove('active');
    document.body.style.overflow = '';

    setTimeout(() => {
      if (this.popupContent) this.popupContent.innerHTML = '';
      this.currentProduct = null;
      this.selectedVariant = null;
    }, 300);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ProductPopup();
});
