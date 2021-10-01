<template>
    <div class="cli-component-name">
        <div class="cli-component-name-title">
            <p>{{name}}</p>
        </div>
        <div class="cli-component-name-content">{{value}}</div>
        <div class="cli-component-name-action">
            <button @click="increment">increment+</button>
            <button @click="decrement">decrement-</button>
        </div>
    </div>
</template>
<script>
export default {
    name: "cli-component-name",
    data() {
        return {
            value: 0,
            name: "cli-component-name"
        };
    },
    methods: {
        increment() {
            this.value += 1;
        },
        decrement() {
            this.value -= 1;
        }
    }
};
</script>
<style scoped lang="scss">
.cli-component-name {
    width: 300px;
    margin: auto;
    text-align: center;

    .cli-component-name-title {
        font-size: 30px;
    }

    .cli-component-name-content {
        padding: 10px 10px;
        color: red;
        font-size: 20px;
        font-weight: bold;
    }

    .cli-component-name-action {
        button {
            padding: 5px 5px;
        }
    }
}
</style>