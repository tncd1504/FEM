%--------------------------------------------------------------------------
% PURPOSE 
%    Plate problem use MITC4 of Bathe
%    Analysic static for circle plate
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh                                              
%   FOSAT Group – HCMC, Vietnam                                             
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com                                          
%   Last modified: December 2012                                            
%--------------------------------------------------------------------------

clear all; close all
format long;
global gcoord nodes nnode nel
E = 10920;
nuy = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
t = L/1e1;
rho = 0;
q = -(rho*t + 1);
nx = 30;                 % so phan tu theo phuong x
ny = 30;                 % so phan tu theo phuong y
nel= nx*ny;              % number of elements   
nnel=4;                  % number of nodes per element
ndof=3;                  % number of dofs per node
nnode=(nx+1)*(ny+1);     % total number of nodes in system
sdof=nnode*ndof;         % total system dofs  
edof=nnel*ndof;          % degrees of freedom per element

type_element = 'Q4';     % loai phan tu
[nodes,gcoord] = mesh_square_plate(type_element,L,H,nx,ny);

%------------------------------ Plot grid ---------------------------------
% plot_mesh(type_element,gcoord,nodes,nel)

%---------------------------- buondary condition---------------------------
type_condition = 'CCCC';
[bcdof,bcval]=boundary_condition(type_condition,ndof,nx,ny);

%----------------xac dinh cac ma tran vat lieu Db va Ds -------------------
Db = material_matrix(1,E,nuy)*t^3/12;  % bending material property
shearm=0.5*E/(1.0+nuy);       % shear modulus
shcof=5/6;                    % shear correction factor
% Ds = shearm*shcof*t*[1 0; 0 1];    
Ds = shcof*t*shearm*[1  0; 0  1]; % shear material property
%------------------------- diem Gauss ------------------------
nglx = 2; ngly = 2;        % 2x2 Gauss-Legendre quadrature for bending 
nglb  = nglx*ngly;         % number of sampling points per element for bending
alstab=0.1;
%------------------------------- Tinh K & F -------------------------------

K=zeros(sdof);
F=zeros(sdof,1);
index=zeros(edof,1);    

[point,weight]=Gauss_2D(nglx,ngly);     % sampling points & weights
for i=1:nel
    nd=nodes(i,:);
    xcoord = gcoord(nd,1)'; ycoord = gcoord(nd,2)';
%     % he so hieu chinh thanh phan cat
%     [side]=cal_side(xcoord,ycoord);
%     he=max(side);
%     Ds=shearm*shcof*t^3/(t^2+alstab*he^2)*[1 0; 0 1];
    
    kb=zeros(edof);
    ks=zeros(edof);         
    f=zeros(edof,1);
    
    for intx=1:nglx
        x   = point(1,intx);                         % sampling point in x-axis
        wtx = weight(1,intx);                        % weight in x-axis
        for inty=1:ngly
            y   = point(2,inty);                    % sampling point in y-axis
            wty = weight(2,inty);                   % weight in y-axis            
            [shape,dNdxi,dNdeta] = shape_Q4(x,y,1); % ham dang va dao ham N
            jacob2 = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);  % compute Jacobian
            detjacob = det(jacob2);                   % determinant of Jacobian
            invjacob = inv(jacob2);                   % inverse of Jacobian matrix            
            [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob); % derivatives w.r.t.
            % ma tran do cung uon
            Bb = Bb_Bathe(nnel,dNdx,dNdy);      
            kb = kb+Bb'*Db*Bb*wtx*wty*detjacob; 
            % tinh ma tran do cung cat
            Bsn = Bs_Natural_MITC4(nnel,xcoord,ycoord,dNdxi,dNdeta);
            Bs = invjacob*Bsn;
            ks = ks+ Bs'*Ds*Bs*wtx*wty*detjacob;
            % tinh luc tac dung tren phan tu
            f = f+ q*[shape(1); 0; 0; shape(2); 0; 0;...
                shape(3); 0; 0; shape(4); 0; 0]*wtx*wty*detjacob;
        end
    end    
    k=kb+ks;
    index=index_assemble(nd,nnel,ndof);% extract system dofs associated with element
    K(index,index)=K(index,index)+k;
    F(index)=F(index)+f;
end

%------------------------------ tinh do vong ------------------------------
[KK,ff]=apply_condition(K,F,bcdof,bcval);
U = KK\ff;
W = U(1:3:end);    % do vong
W_max = max(abs(W));
figure('color',[1 1 1])
trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
shading interp
view(0,90)
D1=E*t^3/12/(1-nuy^2);
sosanh = W_max*D1/L^4





% % %--------------------------------------------------------------------------
% % %                                HAU XU LY
% % %--------------------------------------------------------------------------
% %------------------------------- tinh moment ------------------------------
% [pointb,weightb]=feglqd2(nglxb,nglyb);     % sampling points & weights
% for i=1:nel
%     xcoord=gcoord(nodes(i,:),1)';
%     ycoord=gcoord(nodes(i,:),2)';
%     nd=nodes(i,:);
%     
%     kb=zeros(edof);
%     ks=zeros(edof);   
%     
%     for intx=1:nglxb
%         x=pointb(intx,1);                          % sampling point in x-axis
%         wtx=weightb(intx,1);                       % weight in x-axis
%         for inty=1:nglyb
%             y=pointb(inty,2);                      % sampling point in y-axis
%             wty=weightb(inty,2) ;                  % weight in y-axis
%             [shape,dhdr,dhds]=feisoq4(x,y,1);      % ham dang va dao ham N
%             jacob2=fejacob2(nnel,dhdr,dhds,xcoord,ycoord);  % compute Jacobian
%             detjacob=det(jacob2);                 % determinant of Jacobian
%             invjacob=inv(jacob2);                 % inverse of Jacobian matrix
%             [dhdx,dhdy]=federiv2(nnel,dhdr,dhds,invjacob); % derivatives w.r.t.
%             Bb=fekinepb_Bathe(nnel,dhdx,dhdy)          % bending kinematic matrix
%                         
%             kinmtps=shearNaturalStrain_MITC(nnel,xcoord,ycoord,dhdr,dhds)
%             Bs=invjacob*kinmtps;       
%         end
%     end
%     index=feeldof(nd,nnel,ndof);% extract system dofs associated with element
%     for ii=1:12
%         eldisp(ii)=Disp(index(ii));
%     end
%     moment1=Db*Bb*eldisp';            % compute stresses
%     for iii=1:3
%         moment(iii,i)=moment1(iii);     % store for each element          
%     end
% 
%     % calculate shear force
%     shear1=Ds*Bs*eldisp';
%     for iiii=1:2
%         shear(iiii,i)=shear1(iiii);     % store for each element          
%     end
% end
% %-----------------------moment cho tung node -----------------
% moment_nod=zeros(3,nnode);
% [nod_adjele]=get_nod_adjele;
% 
% for ino=1:nnode    % loop for all nodes 
%     area_inode=0;  % area of all elements associated with (ino)-th node
%     for iel=1:size(nod_adjele{ino},2)
%         moment_nod(:,ino)= moment_nod(:,ino)+ moment(:,nod_adjele{ino}(iel))*area{nod_adjele{ino}(iel)};                                              
%         area_inode = area_inode + area{nod_adjele{ino}(iel)};                                 
%     end
%     moment_nod(:,ino)= moment_nod(:,ino)/area_inode;
% end
% m=(moment_nod(1,1)+moment_nod(2,1))/2
% 
% 
% 
% 
% 
% 
% 
% 
% 
% 
% 
% 
