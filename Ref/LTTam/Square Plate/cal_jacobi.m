function [jacob2]=cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord)

%------------------------------------------------------------------------
%  Purpose:
%     determine the Jacobian for two-dimensional mapping
%
%  Synopsis:
%     [jacob2]=fejacob2(nnel,dNdxi,dNdeta,xcoord,ycoord) 
%
%  Variable Description:
%     jacob2 - Jacobian for one-dimension
%     nnel - number of nodes per element   
%     dNdxi - derivative of shape functions w.r.t. natural coordinate r
%     dNdeta - derivative of shape functions w.r.t. natural coordinate s
%     xcoord - x axis coordinate values of nodes
%     ycoord - y axis coordinate values of nodes
%------------------------------------------------------------------------

 jacob2=zeros(2,2);

 for i=1:nnel
 jacob2(1,1)=jacob2(1,1)+dNdxi(i)*xcoord(i);
 jacob2(1,2)=jacob2(1,2)+dNdxi(i)*ycoord(i);
 jacob2(2,1)=jacob2(2,1)+dNdeta(i)*xcoord(i);
 jacob2(2,2)=jacob2(2,2)+dNdeta(i)*ycoord(i);
 end
