// src/Components/Order/Customer/Cart.js
import React, { useContext, useState, useMemo } from "react";
import "./Cart.css";
import { useNavigate } from "react-router-dom";
import { formatLKR } from "../../../utils/currency";
import { CartContext } from "./CartContext";

const getItemKey = (item) => (item?.lineId || item?.variantKey || item?.productId || "").toString();

function Cart({ onCheckout, embedded = false }) {
  const { cartItems, removeFromCart, updateQuantity } = useContext(CartContext);
  const [selectedItems, setSelectedItems] = useState([]);
  const navigate = useNavigate();

  const handleIncrease = (id) => {
    const item = cartItems.find((i) => getItemKey(i) === id);
    if (!item) return;
    updateQuantity(id, Math.max(1, Number(item.quantity || 0) + 1));
  };

  const handleDecrease = (id) => {
    const item = cartItems.find((i) => getItemKey(i) === id);
    if (!item) return;
    if (item.quantity > 1) {
      updateQuantity(id, Math.max(1, Number(item.quantity) - 1));
    }
  };

  const handleInputChange = (id, value) => {
    let qty = parseInt(value, 10);
    if (Number.isNaN(qty)) qty = 1;
    qty = Math.max(1, qty);
    updateQuantity(id, qty);
  };

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === cartItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map((item) => getItemKey(item)));
    }
  };

  const subtotal = useMemo(
    () =>
      cartItems
        .filter((item) => selectedItems.includes(getItemKey(item)))
        .reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cartItems, selectedItems]
  );

  const proceedToCheckout = async () => {
    const selected = cartItems.filter((item) => selectedItems.includes(getItemKey(item)));
    if (selected.length === 0) return;
    // guard: ensure all quantities valid
    for (const it of selected) {
      if (!Number.isInteger(it.quantity) || Number(it.quantity) <= 0) return;
    }

    // Try to sync selected items to server-side cart for logged-in users
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/carts`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: cartItems }),
        });
      }
    } catch (err) {
      console.warn('Failed to sync cart before checkout', err);
    }

    if (onCheckout) {
      onCheckout(selected);
    } else {
      navigate('/Checkout', { state: { selectedItems: selected } });
    }
  };

  return (
    <div className={`cart-page${embedded ? " cart-page--embedded" : ""}`}>
      <h2>{embedded ? "Cart" : "Shopping Cart"}</h2>

      {cartItems.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          <div className="select-all">
            <input
              type="checkbox"
              checked={selectedItems.length === cartItems.length && cartItems.length > 0}
              onChange={handleSelectAll}
            />
            <label>Select All</label>
          </div>

          {cartItems.map((item) => {
            const itemKey = getItemKey(item);
            return (
              <div className="cart-item" key={itemKey}>
              <input
                type="checkbox"
                checked={selectedItems.includes(itemKey)}
                onChange={() => handleSelectItem(itemKey)}
              />
              <img src={item.img} alt={item.name} />
              <div className="item-details">
                <h3>{item.name}</h3>
                {(item.color || item.size) && (
                  <p className="item-variant">
                    {item.color && <span>Color: {item.color}</span>}
                    {item.color && item.size ? " · " : ""}
                    {item.size && <span>Size: {item.size}</span>}
                  </p>
                )}
                <p>Unit Price: {formatLKR(item.price)}</p>
                <div className="quantity">
                  <button onClick={() => handleDecrease(itemKey)}>-</button>
                  <input
                    type="number"
                    value={Number(item.quantity) || 1}
                    onChange={(e) => handleInputChange(itemKey, e.target.value)}
                    min="1"
                    step="1"
                    inputMode="numeric"
                  />
                  <button onClick={() => handleIncrease(itemKey)}>+</button>
                </div>
                <p>Total: {formatLKR(item.price * item.quantity)}</p>
                <button className="remove" onClick={() => removeFromCart(itemKey)}>
                  Remove
                </button>
              </div>
            </div>
            );
          })}
        </>
      )}

      {cartItems.length > 0 && (
        <div className="cart-summary">
          <p>Subtotal (selected): {formatLKR(subtotal)}</p>
          <h3>Grand Total: {formatLKR(subtotal)}</h3>
          <button
            className="Checkout"
            disabled={selectedItems.length === 0}
            onClick={proceedToCheckout}
          >
            Proceed to Checkout ({selectedItems.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default Cart;
