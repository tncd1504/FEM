function [S,area] = QdStrs_AMR(nodes,dmat,displ,poiss,thick,pstrs)

%% QdStrs Evaluates the stresses for a quadrilateral element
%
%  Parameters:
%
%    Input, nodes : Contains the 2D coordinates of the element nodes
%           dmat  : Constitutive matrix
%           displ : Nodal displacement
%           poiss : Poisson ratio
%           thick : Thickness 
%           pstrs : Flag for Plane Stress
%   
%    Output, S the element constant stress vector
%         area the element area

  c(1) = nodes(2,2) - nodes(3,2);
  c(2) = nodes(3,2) - nodes(1,2);  
  
  d(1) = nodes(3,1) - nodes(2,1);
  d(2) = nodes(1,1) - nodes(3,1);
  
  e(1) = nodes(3,2) - nodes(4,2);
  e(2) = nodes(4,2) - nodes(1,2);
  
  f(1) = nodes(4,1) - nodes(3,1);
  f(2) = nodes(1,1) - nodes(4,1);
  
  area2 = abs(c(1)*d(2) - c(2)*d(1)) + abs(e(1)*f(2) - e(2)*f(1));
  area  = area2 / 2;
  
  fform = @(s,t)[(1-s-t+s*t)/4,(1+s-t-s*t)/4,(1+s+t+s*t)/4,(1-s+t-s*t)/4];
  deriv = @(s,t)[(-1+t)/4,( 1-t)/4,( 1+t)/4,(-1-t)/4 ;
                 (-1+s)/4,(-1-s)/4,( 1+s)/4,( 1-s)/4 ];

  pospg = [ -0.577350269189626E+00 ,  0.577350269189626E+00 ];
  pespg = [  1.0E+00 ,  1.0E+00 ];

  strsg = [];
  extrap = [];
  order = [ 1 , 4 ; 2 , 3 ];    % Align the G-pts. with the element corners
  
  for i = 1 : 2
    for j = 1 : 2
      lcder = deriv(pospg(i),pospg(j)) ;           % SF Local derivatives
      xjacm = lcder*nodes ;                        % Jacobian matrix
      ctder = xjacm\lcder ;                        % SF Cartesian derivates
      
      bmat = [];
      for inode = 1 : 4
        bmat = [ bmat , [ctder(1,inode),            0 ;
                                     0 ,ctder(2,inode);
                         ctder(2,inode),ctder(1,inode)] ];
      end
      
      strsg(:,order(i,j)) = (dmat*bmat*displ) ;
      
      a = 1/pospg(i);
      b = 1/pospg(j);
 
      extrap(order(i,j),:) = fform(a,b) ;
    end
  end

  se = transpose(extrap*transpose(strsg));

% Plane Stress
  if (pstrs == 1)
    S = se ;
% Plane Strain
  else                
    S = [ se(1,:); se(2,:);-poiss*(se(1,:)+se(2,:)); se(3,:)];
  end

