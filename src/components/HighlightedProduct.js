import React from 'react';
import './css/highlightedProduct.css';
import { faBoxes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SortArray from 'sort-array';

class ProductComp extends React.Component {
    constructor(props) {
      super(props);
      this.productButton = React.createRef();
    }

    renderStoreStock = () =>{
      let list = [];
      let stores = this.props.product.Stock.Stores;
      SortArray(stores,{
        by: "displayName"
      });
      stores.map( store => (
      list.push(<li key={store.id}><strong>{store.displayName}:</strong> {store.stockInfo.stockLevel} stk</li>)        
      ));
      return list;
    } 

    render(){
      var {product, selectedStore} = this.props;
      var background = {
          backgroundImage: "url(https://bilder.vinmonopolet.no/cache/100x100/" + product.Id + "-1.jpg)",
      };
      var priceIsLower = product.LatestPrice < product.ComparingPrice;
      var lastChangedDate = new Date(product.LastUpdated);
      if(product.Stock){
        var stock = product.Stock.stock > 99 ? "99+" : product.Stock.stock;
        
        var store = product.Stock.Stores.find( s => s.name === selectedStore);
        if(store){
          stock = store.stockInfo.stockLevel  > 99 ? "99+" : store.stockInfo.stockLevel;
        }
      }

    return (
      
      <div id={product.Id} className={"HighlightedProduct " + (priceIsLower ? "price_lowered" : "price_raised") } >
          
        <div className="product_img" style={background}></div>
        <div className="product_details">
            <h2 className="name">{product.Name}</h2>
            <span className="price">Kr. {product.LatestPrice}</span>
            <span className="details">
              {product.SubType}, {product.Country} <br />{product.Volume*100} cl, Alk. {product.Alcohol}%
            </span>
            {product.Description &&
            <span className="description" >
              <p className="colour"><span>Farge</span> {product.Description.characteristics.colour}</p>
            <p className="odour"><span>Lukt</span> {product.Description.characteristics.odour}</p>
            <p className="taste"><span>Smak</span> {product.Description.characteristics.taste}</p>
            </span>
            }
        </div>
        <div className="product_stock">
          <ul>
          {this.renderStoreStock()}
          </ul>
        </div>
      </div>
      
    );
  }
}

export default ProductComp;
