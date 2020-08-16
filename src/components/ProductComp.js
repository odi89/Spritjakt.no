import React from 'react';
import './css/productComp.css';
import { faBoxes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

class ProductComp extends React.Component {
    constructor(props) {
      super(props);
      this.productButton = React.createRef();
    }
    render(){
      var {product, showDiff, selectedStore} = this.props;
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
      
      <li id={product.Id} className={"ProductComp " + (priceIsLower ? "price_lowered" : "price_raised") } onClick={() => this.props.setGraph(product.Id, this.productButton)}>
        
            <button style={{padding:0,opacity:0}} ref={this.productButton} onClick={() => this.props.setGraph(product.Id, this.productButton)}></button>
            <div className="product_img" style={background}>
            </div>
            {( showDiff && product.Discount !== "0.0") &&
            <span className="percentage_change">{(priceIsLower ? "" : "+") + product.Discount}%</span>
          }
            <span className="change_time">Endret <br /> {lastChangedDate.toISOString().slice(0,10)}</span>
            <div className="product_details">
                <h2 className="name">{product.Name}</h2>
                <span className="type">{product.SubType}</span>
                <span className="stock" title="Lagerstatus" >{product.Stock ? stock : "Må bestilles"} <FontAwesomeIcon icon={faBoxes} /></span>
                <span className="volume">{product.Volume*100} cl</span>
                <span className="alcohol">Alk. {product.Alcohol}%</span>
                <span className="price">Kr. {product.LatestPrice}</span>
                { showDiff &&
                  <span className="old_price">Kr. {product.ComparingPrice}</span>
                }
            </div>
      </li>
      
    );
  }
}

export default ProductComp;
