import React from "react";
//import "./css/StoreSelector.css";
import StoreButton from "./StoreButton";
import SortArray from "sort-array";
import Select from 'react-select'

class StoreSelector extends React.Component {
  constructor() {
    super();
    this.state = {
      stores: [],
      selectedOptions: [],
      storeOptions: [],
    };
    this.ProductFetchTimeout = null;
  }

  componentDidMount() {
    let stores = this.props.stores;

    SortArray(stores, {
      by: ["city", "storeName"],
      computed: {
        city: s => s.address.city
      }
    });

    let storeOptions = [];
    stores.map(s => {
      storeOptions.push({
        value: s.storeId,
        label: s.storeName + " (" + (s.count === undefined ? 0 : s.count) + ") ",
        disabled: s.count === undefined
      });
    });

    this.setState({
      stores: stores,
      storeOptions: storeOptions,
    });
  }
  handleStoreUpdate = (storeOptions) => {
    let list = [];
    if (storeOptions && storeOptions.length > 0) {
      storeOptions.map(s => {
        list.push(s.value);
      });
    } else {
      list.push("0");
    }
    this.setState({
      selectedOptions: storeOptions
    });

    this.props.handleStoreUpdate(list);
  }

  render() {
    return (
      <div className="Stores">
        <Select
          value={this.state.selectedOptions}
          onChange={this.handleStoreUpdate}
          isMulti
          options={this.state.storeOptions}
          isOptionDisabled={o => o.disabled === true}
        />
      </div>
    );
  }
}

export default StoreSelector;
