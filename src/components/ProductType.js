import React from 'react';
import './css/productType.css';

class ProductType extends React.Component {

    render(){
    var {handleFilterUpdate, productType, name, store}  =  this.props;
    return (
    <label className={"clickable ProductType " + productType.state}>
        <input type="checkbox" name={name} onClick={() => handleFilterUpdate(!productType.state, name)} defaultChecked={productType.state} />
        <span className="name" >{name}</span>
        <span className="count">{productType.count[store]}</span>
    </label>
    );
  }
}

export default ProductType;
