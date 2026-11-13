function [shapeT3,dNdxi,dNdeta]=shape_T3(xi,eta)

%------------------------------------------------------------------------
%  Purpose:
%     compute isoparametric four-node quadilateral shape functions
%     and their derivatves at the selected (integration) point
%     in terms of the natural coordinate 
%
%  Synopsis:
%     [shapeT3,dNdxi,dNdeta]=shape_T3(xi,eta)  
%
%  Variable Description:
%     shapeq4 - shape functions for four-node element
%     dNdxi - derivatives of the shape functions w.r.t. r
%     dNdeta - derivatives of the shape functions w.r.t. s
%     xi - r coordinate value of the selected point   
%     eta - s coordinate value of the selected point
%
%  Notes:
%     1st node at (0,0), 2nd node at (1,0), 3rd node at (0,1)
%------------------------------------------------------------------------

% shape functions

 shapeT3(1)= 1-xi-eta;
 shapeT3(2)= xi;
 shapeT3(3)= eta;
 
% derivatives

 dNdxi(1)= -1 ;
 dNdxi(2)= 1;
 dNdxi(3)= 0;
 
 dNdeta(1)= -1;
 dNdeta(2)= 0;
 dNdeta(3)= 1;
 
