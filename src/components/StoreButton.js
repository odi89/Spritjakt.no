import React from "react";
//import "./css/storebutton.css";

class StoreButton extends React.Component {
    render() {
        var { store, setStore } = this.props;
        return (
            <label className={"clickable StoreButton " + store.state}>
                <input
                    type="checkbox"
                    name={store.storeId}
                    onClick={() => setStore(!store.state, store.storeId)}
                    defaultChecked={store.state}
                />
                <span className="name">{store.storeName}</span>
                <span className="count">{store.count}</span>
            </label>
        );
    }
}

export default StoreButton;
