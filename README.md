# LiteZ.js Framework

LiteZ.js is a lightweight JavaScript framework designed for simple and reactive web applications. It provides an intuitive syntax and directive-based approach similar to Vue.js.

## Features

- **Directives**: `z-for`, `z-if`, `z-text`, `z-show`, etc.
- **Event Handling**: `z-on:event` for handling user interactions.
- **Component-based UI**: Reusable UI elements.
- **Lifecycle Hooks**: Control different stages of a component.
- **Error Handling**: Built-in error management for debugging.

---

## 1. Installation
To use LiteZ.js, include the following script in your HTML file:

```html
<script src="litez.js"></script>
```

---

## 2. Directives

### `z-for` (Loop Through Array)
Used to loop through an array and render items dynamically.

```html
<ul>
  <li z-for="item in items">{{ item }}</li>
</ul>
```
```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { items: ["Apple", "Banana", "Cherry"] };
  }
});
```

---

### `z-if` (Conditional Rendering)
Displays or removes elements based on a condition.

```html
<p z-if="isVisible">This text is visible!</p>
```
```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { isVisible: true };
  }
});
```

---

### `z-text` (Text Binding)
Binds text content dynamically.

```html
<p z-text="message"></p>
```
```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { message: "Hello, LiteZ.js!" };
  }
});
```

---

### `z-show` (Conditional Display)
Hides elements using CSS `display: none;` instead of removing them from the DOM.

```html
<p z-show="isVisible">This is conditionally shown</p>
```
```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { isVisible: true };
  }
});
```

---

## 3. Event Handling
Handle events using `z-on:event`.

```html
<button z-on:click="increaseCount">Click Me</button>
<p z-text="count"></p>
```
```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { count: 0 };
  },
  methods: {
    increaseCount() {
      this.count++;
    }
  }
});
```

---

## 4. Components
Create reusable components with `LiteZ.component()`.

```js
LiteZ.component("hello-world", {
  template: "<p>Hello, {{ name }}!</p>",
  data() {
    return { name: "LiteZ" };
  }
});
```

Usage:
```html
<hello-world></hello-world>
```

---

## 5. Lifecycle Hooks
LiteZ.js provides lifecycle hooks to control component behavior.

```js
LiteZ.createApp({
  el: "#app",
  data() {
    return { message: "Hello!" };
  },
  beforeCreate() {
    console.log("Before Create");
  },
  created() {
    console.log("Created");
  },
  beforeMount() {
    console.log("Before Mount");
  },
  mounted() {
    console.log("Mounted");
  }
});
```

Lifecycle stages:
| Hook Name       | Description |
|----------------|------------|
| **beforeCreate** | Before data & methods initialization |
| **created** | After data & methods initialization |
| **beforeMount** | Before rendering the template |
| **mounted** | After rendering and inserting into the DOM |

---

## 6. Error Handling
Error handling can be implemented using the `handleError()` function.

```js
handleError(error, message) {
  console.error(`[LiteZ.js Error]: ${message}`, error);
}
```

---

## Summary

- **Simple & lightweight**
- **Easy data binding & directives**
- **Component-based architecture**
- **Lifecycle management**
- **Error handling for debugging**

Start using LiteZ.js today and build reactive web applications with ease! 🚀

