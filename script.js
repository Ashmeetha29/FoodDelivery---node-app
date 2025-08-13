// script.js — callback-style orchestration
// Base API URL
const API = "http://localhost:5000/api";

// UI Elements
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const restaurantCard = document.getElementById("restaurantCard");
const restName = document.getElementById("restName");
const restMenu = document.getElementById("restMenu");
const orderItemInput = document.getElementById("orderItem");
const orderBtn = document.getElementById("orderBtn");
const payBtn = document.getElementById("payBtn");
const deliverBtn = document.getElementById("deliverBtn");
const statusText = document.getElementById("statusText");
const receipt = document.getElementById("receipt");
const receiptContent = document.getElementById("receiptContent");
const forceFail = document.getElementById("forceFail");

// tracker steps
const step = id => document.getElementById("step-" + id);
function resetTracker(){
  ["search","order","payment","delivery"].forEach(s=>{
    let el = step(s);
    el.className = "pending";
  });
}
function markDone(which){ step(which).className = "done"; }
function markFailed(which){ step(which).className = "failed"; }

// small UI helpers
function setStatus(txt){ statusText.innerText = txt; }
function showReceipt(obj){
  receipt.classList.remove("hide");
  receiptContent.innerText = JSON.stringify(obj, null, 2);
}

// CALLBACK FUNCTIONS (each accepts a callback(err, data))

function searchRestaurant(name, cb){
  setStatus("Searching for restaurant: " + name + " ...");
  markDone("search"); // mark start visually (we'll change if not found)
  fetch(API + "/search?name=" + encodeURIComponent(name))
    .then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body }) => {
      if (!ok) return cb(body.error || "Search failed");
      cb(null, body);
    })
    .catch(err => cb("Network error while searching"));
}

function placeOrder(restaurantName, item, cb){
  setStatus("Placing order for " + item + " at " + restaurantName + " ...");
  fetch(API + "/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantName, item })
  }).then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body })=>{
      if (!ok) return cb(body.error || "Order failed");
      cb(null, body);
    }).catch(e=>cb("Network error while placing order"));
}

function processPayment(orderId, amount, cb){
  setStatus("Processing payment of $" + amount + " ...");
  const force = !!forceFail.checked;
  fetch(API + "/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amount, forceFail: force })
  }).then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body })=>{
      if (!ok) return cb(body.error || "Payment failed");
      cb(null, body);
    }).catch(e=>cb("Network error during payment"));
}

function confirmDelivery(orderId, cb){
  setStatus("Confirming delivery for " + orderId + " ...");
  fetch(API + "/delivery?orderId=" + encodeURIComponent(orderId))
    .then(res => res.json().then(body => ({ ok: res.ok, body })))
    .then(({ ok, body })=>{
      if (!ok) return cb(body.error || "Delivery confirmation failed");
      cb(null, body);
    }).catch(e=>cb("Network error while confirming delivery"));
}

/* UI wiring + complete callback flow:
   Search -> Place Order -> Process Payment -> Confirm Delivery
   Each button can trigger its step, but the full flow is chained when you press "Place Order".
*/

searchBtn.onclick = function(){
  resetTracker();
  restaurantCard.classList.add("hide");
  const name = searchInput.value.trim();
  if (!name){ setStatus("Type a restaurant name to search"); return; }
  searchRestaurant(name, function(err, restaurant){
    if (err){
      setStatus("Search failed: " + err);
      markFailed("search");
      return;
    }
    // success: show restaurant
    restName.innerText = restaurant.name;
    restMenu.innerHTML = restaurant.menu.map(m => `${m.item} — $${m.price}`).join("<br>");
    restaurantCard.classList.remove("hide");
    setStatus("Found restaurant: " + restaurant.name);
    markDone("search");
  });
};

orderBtn.onclick = function(){
  const rest = restName.innerText;
  const item = orderItemInput.value.trim();
  if (!rest || rest === "—"){ setStatus("Search a restaurant first"); return; }
  if (!item){ setStatus("Type the exact menu item to order"); return; }

  // place order then chain payment and delivery (callback style)
  markDone("search");
  placeOrder(rest, item, function(err, orderRes){
    if (err){
      setStatus("Order failed: " + err);
      markFailed("order");
      return;
    }
    setStatus("Order Placed: " + orderRes.orderId + " — amount $" + orderRes.amount);
    markDone("order");
    showReceipt({ stage: "order_placed", order: orderRes });

    // next: payment
    processPayment(orderRes.orderId, orderRes.amount, function(err, payRes){
      if (err){
        setStatus("Payment failed: " + err);
        markFailed("payment");
        return;
      }
      setStatus("Payment successful: " + payRes.paymentId);
      markDone("payment");
      showReceipt({ stage: "paid", order: orderRes, payment: payRes });

      // next: delivery
      confirmDelivery(orderRes.orderId, function(err, delRes){
        if (err){
          setStatus("Delivery failed: " + err);
          markFailed("delivery");
          return;
        }
        setStatus("Delivered: " + new Date(delRes.deliveredAt).toLocaleString());
        markDone("delivery");
        showReceipt({ stage: "delivered", order: orderRes, payment: payRes, delivery: delRes });
      });

    });
  });
};

// You can also run steps individually
orderBtn.addEventListener("auxclick", e=>{}); // noop placeholder

payBtn.onclick = function(){
  // try to pay using last order id from receipt if present
  try{
    const r = JSON.parse(receiptContent.innerText);
    if (!r.order || !r.order.orderId){ setStatus("No order to pay for — place order first"); return; }
    processPayment(r.order.orderId, r.order.amount, function(err, payRes){
      if (err){ setStatus("Payment failed: " + err); markFailed("payment"); return; }
      setStatus("Payment OK: " + payRes.paymentId); markDone("payment");
      showReceipt(Object.assign(r, { payment: payRes }));
    });
  }catch(e){
    setStatus("No receipt/order found. Use the Place Order flow.");
  }
};

deliverBtn.onclick = function(){
  try{
    const r = JSON.parse(receiptContent.innerText);
    if (!r.order || !r.order.orderId){ setStatus("No order to confirm delivery for"); return; }
    confirmDelivery(r.order.orderId, function(err, delRes){
      if (err){ setStatus("Delivery failed: " + err); markFailed("delivery"); return; }
      setStatus("Delivered: " + new Date(delRes.deliveredAt).toLocaleString()); markDone("delivery");
      showReceipt(Object.assign(r, { delivery: delRes }));
    });
  }catch(e){
    setStatus("No receipt/order found. Use the Place Order flow.");
  }
};

// initialize
resetTracker();
setStatus("Ready — search a restaurant to start");
