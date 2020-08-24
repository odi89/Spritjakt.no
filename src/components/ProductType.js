import React from "react";
import "./css/productType.css";

class ProductType extends React.Component {
  render() {
    var { handleFilterClick, productType, name } = this.props;
    return (
      <label className={"clickable ProductType " + productType.state}>
        <input
          type="checkbox"
          name={name}
          onClick={() => handleFilterClick(!productType.state, name)}
          defaultChecked={productType.state}
        />
        <span className="name">{name}</span>
        <span className="count">{Object.keys(productType.products).length}</span>
      </label>
    );
  }
}

export default ProductType;
